import Holidays from 'date-holidays';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado.interface.js';
import { Rol } from '../common/roles.js';
import { AuditoriaModulo } from '../common/entities/auditoria-modulo.entity.js';
import {
  IndicadorMetodologia,
  PUNTAJE_NO_APLICA_PREFIX,
} from '../administracion-de-la-metodologia/entities/indicador-metodologia.entity.js';
import { MetodologiaVersion } from '../administracion-de-la-metodologia/entities/metodologia-version.entity.js';
import { PesoGrupo } from '../administracion-de-la-metodologia/entities/peso-grupo.entity.js';
import { Clasificacion, EstadoVisita, TipoPredio } from '../visitas/visitas.tipos.js';
import { Visita } from '../visitas/entities/visita.entity.js';
import { clasificar } from '../visitas/calificacion.js';
import type { CerrarVisitaDto } from './dto/cerrar-visita.dto.js';
import type { RecibirDocumentosDto } from './dto/recibir-documentos.dto.js';
import type { RespuestaIndicadorDto } from './dto/respuesta-indicador.dto.js';
import { ActaVisita } from './entities/acta-visita.entity.js';

type FilaCatalogo = {
  id: string;
  clave: string;
  nombre: string;
  grupoMedida: 'MBA' | 'MBR' | 'MBG';
  metodoEvaluacion: string;
  gruposProductivos: string[];
  referenciaManual: string;
  escalaPuntaje: Record<'0' | '1' | '2', string>;
};

type ResultadoIndicador = {
  indicadorId: string;
  clave: string;
  nombre: string;
  grupoMedida: string;
  puntaje: number;
  puntajesDisponibles: number[];
  porcentaje: number;
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA';
  observacion: string | null;
};

type ResultadoVisita = {
  grupoProductivo: string;
  calificacionFinal: number;
  clasificacion: Clasificacion;
  grupos: Array<{
    grupoMedida: string;
    promedio: number;
    peso: number;
    aporte: number;
  }>;
  indicadores: ResultadoIndicador[];
  observaciones: string | null;
};

type FilaHistorial = {
  acta: ActaVisita;
  visita: Visita;
};

const GRUPOS_MEDIDA = ['MBA', 'MBR', 'MBG'] as const;

@Injectable()
export class CierreYReportesFaseIvService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CierreYReportesFaseIvService.name);
  private readonly festivosColombia = new Holidays('CO');
  private tareaVencimientos?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(ActaVisita)
    private readonly actas: Repository<ActaVisita>,
    @InjectRepository(Visita)
    private readonly visitas: Repository<Visita>,
    @InjectRepository(MetodologiaVersion)
    private readonly versiones: Repository<MetodologiaVersion>,
    @InjectRepository(IndicadorMetodologia)
    private readonly indicadores: Repository<IndicadorMetodologia>,
    @InjectRepository(PesoGrupo)
    private readonly pesos: Repository<PesoGrupo>,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    this.tareaVencimientos = setInterval(() => {
      void this.finalizarVencidas().catch((error: unknown) => {
        this.logger.error(
          'No se pudo finalizar el plazo de documentos pendientes.',
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, 60_000);
    this.tareaVencimientos.unref?.();
    void this.finalizarVencidas().catch((error: unknown) => {
      this.logger.error(
        'No se pudo revisar el plazo de documentos al iniciar.',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  onModuleDestroy(): void {
    if (this.tareaVencimientos) clearInterval(this.tareaVencimientos);
  }

  async cerrarVisita(
    visitaId: string,
    dto: CerrarVisitaDto,
    actor: UsuarioAutenticado,
  ) {
    const visita = await this.visitaAccesible(visitaId, actor);
    if (![EstadoVisita.EN_CURSO, EstadoVisita.PENDIENTE_DOCUMENTOS].includes(visita.estado)) {
      throw new UnprocessableEntityException('Solo se puede cerrar una visita en curso.');
    }
    if (visita.predio.tipoPredio === TipoPredio.CORRAL && dto.grupoProductivo.startsWith('TRASPATIO_')) {
      throw new BadRequestException('El grupo productivo no corresponde a un predio tipo corral.');
    }
    if (visita.predio.tipoPredio === TipoPredio.TRASPATIO && !dto.grupoProductivo.startsWith('TRASPATIO_')) {
      throw new BadRequestException('El grupo productivo no corresponde a un predio de traspatio.');
    }

    const version = await this.versiones.findOneBy({ activa: true });
    if (!version) throw new ServiceUnavailableException('No hay metodología activa configurada.');
    const [catalogo, pesos] = await Promise.all([
      this.indicadores.findBy({ versionId: version.id, activo: true }),
      this.pesos.findBy({ versionId: version.id, tipoPredio: visita.predio.tipoPredio }),
    ]);
    const aplicables = catalogo.filter((item) =>
      item.gruposProductivos.includes(dto.grupoProductivo),
    );
    if (aplicables.length === 0) {
      throw new UnprocessableEntityException(
        'No hay indicadores activos para el grupo productivo de esta visita.',
      );
    }
    const escalasPorVerificar = aplicables.filter((item) => !escalaVerificada(item));
    if (escalasPorVerificar.length > 0) {
      throw new UnprocessableEntityException(
        `No se puede cerrar la visita hasta transcribir y verificar las escalas oficiales de: ${escalasPorVerificar.map((item) => item.nombre).join(', ')}.`,
      );
    }
    const resultado = this.calcularResultado(
      dto.grupoProductivo,
      this.validarRespuestas(dto.respuestas, aplicables),
      aplicables,
      pesos,
      dto.observaciones ?? null,
    );
    const fechaFirma = new Date();
    const vencimiento = dto.documentosPendientes
      ? this.siguienteDiaHabil(fechaFirma)
      : null;
    const fechaDefinitiva = dto.documentosPendientes ? null : fechaFirma;
    const firma = this.decodificarFirma(dto.firmaBase64);
    const catalogoSnapshot = {
      version: version.nombre,
      tipoPredio: visita.predio.tipoPredio,
      pesos: pesos.map((peso) => ({
        grupoMedida: peso.grupoMedida,
        porcentaje: Number(peso.porcentaje),
      })),
      indicadores: aplicables.map((item) => this.serializarIndicador(item)),
    };
    const pdf = await this.generarActaPdf(
      visita,
      resultado,
      version.nombre,
      dto.documentosPendientes,
      vencimiento,
      fechaDefinitiva,
      firma,
      fechaFirma,
    );

    await this.dataSource.transaction(async (manager) => {
      const actaRepo = manager.getRepository(ActaVisita);
      if (await actaRepo.findOneBy({ visitaId })) {
        throw new UnprocessableEntityException('La visita ya tiene un acta cerrada.');
      }
      const visitaRepo = manager.getRepository(Visita);
      visita.estado = dto.documentosPendientes
        ? EstadoVisita.PENDIENTE_DOCUMENTOS
        : EstadoVisita.CERRADA;
      visita.calificacion = resultado.calificacionFinal.toFixed(2);
      visita.clasificacion = resultado.clasificacion;
      await visitaRepo.save(visita);
      await actaRepo.save({
        visitaId,
        metodologiaVersionId: version.id,
        resultadoSnapshot: resultado as unknown as Record<string, unknown>,
        catalogoSnapshot,
        documentosPendientes: dto.documentosPendientes,
        venceDocumentos: vencimiento,
        fechaDefinitiva,
        firmadaPor: actor.id,
        correoResponsable: dto.correoResponsable,
        pdf,
        firma,
      });
      await manager.getRepository(AuditoriaModulo).insert({
        actorId: actor.id,
        modulo: 'M7',
        accion: 'VISITA_CERRADA',
        recursoId: visitaId,
        detalle: {
          calificacion: resultado.calificacionFinal,
          clasificacion: resultado.clasificacion,
          documentosPendientes: dto.documentosPendientes,
          venceDocumentos: vencimiento?.toISOString() ?? 'sin plazo documental',
          versionMetodologia: version.nombre,
        },
      });
    });

    return { visitaId, ...resultado, documentosPendientes: dto.documentosPendientes, venceDocumentos: vencimiento };
  }

  async recibirDocumentos(
    visitaId: string,
    dto: RecibirDocumentosDto,
    actor: UsuarioAutenticado,
  ) {
    const acta = await this.actaAccesible(visitaId, actor, true);
    const ahora = new Date();
    if (!acta.documentosPendientes || acta.fechaDefinitiva) {
      throw new UnprocessableEntityException('El plazo documental ya terminó o no hay documentos pendientes.');
    }
    if (!acta.venceDocumentos || ahora > acta.venceDocumentos) {
      await this.finalizarUna(acta, ahora);
      throw new UnprocessableEntityException('Venció el plazo de un día hábil; la calificación ya es definitiva.');
    }

    const resultadoPrevio = acta.resultadoSnapshot as unknown as ResultadoVisita;
    const catalogo = this.catalogoDesdeSnapshot(acta.catalogoSnapshot);
    const anteriores: RespuestaIndicadorDto[] = resultadoPrevio.indicadores.map((item) => ({
      indicadorId: item.indicadorId,
      puntaje: item.puntaje,
      ...(item.observacion ? { observacion: item.observacion } : {}),
    }));
    const cambios = dto.respuestas ?? [];
    const mapa = new Map<string, RespuestaIndicadorDto>(
      anteriores.map((respuesta) => [respuesta.indicadorId, respuesta]),
    );
    for (const cambio of cambios) {
      if (!mapa.has(cambio.indicadorId)) {
        throw new BadRequestException('La respuesta no pertenece al snapshot metodológico de esta visita.');
      }
      mapa.set(cambio.indicadorId, cambio);
    }
    const respuestas = [...mapa.values()];
    const pesos = (acta.catalogoSnapshot['pesos'] as Array<{ grupoMedida: string; porcentaje: number }>).map(
      (peso) => ({ grupoMedida: peso.grupoMedida, porcentaje: String(peso.porcentaje) }) as PesoGrupo,
    );
    this.validarRespuestas(respuestas, catalogo as unknown as IndicadorMetodologia[]);
    const resultado = this.calcularResultado(
      resultadoPrevio.grupoProductivo,
      respuestas,
      catalogo as unknown as IndicadorMetodologia[],
      pesos,
      resultadoPrevio.observaciones,
    );
    const firma = await this.firmaDe(acta.id);
    const visita = await this.visitaAccesible(visitaId, actor);
    const pdf = await this.generarActaPdf(
      visita,
      resultado,
      acta.metodologiaVersion.nombre,
      false,
      null,
      ahora,
      firma,
      acta.createdAt,
    );
    await this.dataSource.transaction(async (manager) => {
      const actualizado = (await manager.query(
        `UPDATE "acta_visita"
         SET "resultado_snapshot" = $1::jsonb,
             "documentos_pendientes" = false,
             "vence_documentos" = NULL,
             "fecha_definitiva" = $2,
             "pdf" = $3,
             "updated_at" = now()
         WHERE "id" = $4 AND "fecha_definitiva" IS NULL
         RETURNING "id"`,
        [JSON.stringify(resultado), ahora, pdf, acta.id],
      )) as Array<{ id: string }>;
      if (actualizado.length === 0) {
        throw new UnprocessableEntityException('El acta ya fue finalizada por otra operación.');
      }
      await manager.getRepository(Visita).update(
        { id: visitaId },
        {
          estado: EstadoVisita.CERRADA,
          calificacion: resultado.calificacionFinal.toFixed(2),
          clasificacion: resultado.clasificacion,
        },
      );
      await manager.getRepository(AuditoriaModulo).insert({
        actorId: actor.id,
        modulo: 'M7',
        accion: 'DOCUMENTOS_RECIBIDOS_Y_RECALCULO',
        recursoId: visitaId,
        detalle: {
          cambiosIndicador: cambios.map(({ indicadorId }) => indicadorId),
          calificacion: resultado.calificacionFinal,
          clasificacion: resultado.clasificacion,
        },
      });
    });
    return { visitaId, ...resultado, definitiva: true };
  }

  async obtenerResultado(visitaId: string, actor: UsuarioAutenticado) {
    const acta = await this.actaAccesible(visitaId, actor);
    await this.finalizarSiVencida(acta);
    return {
      visitaId,
      resultado: acta.resultadoSnapshot,
      versionMetodologia: acta.metodologiaVersion.nombre,
      documentosPendientes: acta.documentosPendientes,
      venceDocumentos: acta.venceDocumentos,
      definitiva: acta.fechaDefinitiva !== null,
      predio: acta.visita.predio,
      fechaVisita: acta.visita.programadaPara,
      inspector: {
        id: acta.visita.inspector.id,
        nombreCompleto: acta.visita.inspector.nombreCompleto,
      },
    };
  }

  async obtenerPdf(visitaId: string, actor: UsuarioAutenticado): Promise<Buffer> {
    const acta = await this.actaAccesible(visitaId, actor, true);
    await this.finalizarSiVencida(acta);
    if (!acta.pdf) throw new NotFoundException('No hay acta PDF disponible.');
    return acta.pdf;
  }

  async historial(
    actor: UsuarioAutenticado,
    filtros: { desde?: string; hasta?: string; predioId?: string; tipoPredio?: TipoPredio } = {},
  ) {
    await this.finalizarVencidas();
    let actas = await this.actas.find({
      relations: { visita: { predio: true, inspector: true }, metodologiaVersion: true },
      order: { createdAt: 'DESC' },
    });
    actas = actas.filter((acta) => {
      const visita = acta.visita;
      if (actor.rol === Rol.INSPECTOR && visita.inspectorId !== actor.id) return false;
      if (filtros.predioId && visita.predioId !== filtros.predioId) return false;
      if (filtros.tipoPredio && visita.predio.tipoPredio !== filtros.tipoPredio) return false;
      if (filtros.desde && visita.programadaPara < new Date(filtros.desde)) return false;
      if (filtros.hasta && visita.programadaPara > new Date(`${filtros.hasta}T23:59:59.999Z`)) return false;
      return true;
    });
    return actas.map((acta) => this.filaHistorial(acta));
  }

  async compararVisitas(predioId: string, actor: UsuarioAutenticado) {
    const filas = await this.historial(actor, { predioId });
    if (filas.length === 0) throw new NotFoundException('No hay visitas cerradas para este predio.');
    return filas.map((fila) => ({
      visitaId: fila.visita.id,
      fecha: fila.visita.programadaPara,
      tipoPredio: fila.visita.predio.tipoPredio,
      calificacion: Number(fila.visita.calificacion),
      clasificacion: fila.visita.clasificacion,
      grupos: (fila.acta.resultadoSnapshot as unknown as ResultadoVisita).grupos,
    }));
  }

  async exportarHistorial(actor: UsuarioAutenticado, formato: 'csv' | 'xlsx' | 'pdf') {
    const filas = await this.historial(actor);
    const campos = ['fecha', 'predio', 'tipo', 'inspector', 'grupo', 'calificacion', 'clasificacion'];
    const datos = filas.map((fila) => {
      const resultado = fila.acta.resultadoSnapshot as unknown as ResultadoVisita;
      return {
        fecha: fila.visita.programadaPara.toISOString(),
        predio: fila.visita.predio.nombre,
        tipo: fila.visita.predio.tipoPredio,
        inspector: fila.visita.inspector.nombreCompleto,
        grupo: resultado.grupoProductivo,
        calificacion: Number(fila.visita.calificacion),
        clasificacion: fila.visita.clasificacion ?? '',
      };
    });
    if (formato === 'csv') {
      const quote = (value: unknown) => {
        const texto = typeof value === 'string'
          ? value
          : value == null
            ? ''
            : JSON.stringify(value);
        return `"${texto.replaceAll('"', '""')}"`;
      };
      return {
        contenido: [campos, ...datos.map((fila) => campos.map((campo) => fila[campo as keyof typeof fila]))]
          .map((fila) => fila.map(quote).join(','))
          .join('\r\n'),
        tipo: 'text/csv; charset=utf-8',
        nombre: 'historial-eba.csv',
      };
    }
    if (formato === 'xlsx') {
      const libro = new ExcelJS.Workbook();
      const hoja = libro.addWorksheet('Historial EBA');
      hoja.addRow(campos);
      datos.forEach((fila) => hoja.addRow(campos.map((campo) => fila[campo as keyof typeof fila])));
      hoja.getRow(1).font = { bold: true };
      const contenido = await libro.xlsx.writeBuffer();
      return {
        contenido: Buffer.from(contenido),
        tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        nombre: 'historial-eba.xlsx',
      };
    }
    const contenido = await this.generarPdfHistorial(datos);
    return { contenido, tipo: 'application/pdf', nombre: 'historial-eba.pdf' };
  }

  async enviarActa(
    visitaId: string,
    actor: UsuarioAutenticado,
    correo?: string,
  ): Promise<{ mensaje: string; correo: string }> {
    const acta = await this.actaAccesible(visitaId, actor, true);
    await this.finalizarSiVencida(acta);
    const destinatario = correo ?? acta.correoResponsable;
    if (!destinatario) throw new BadRequestException('Falta el correo del responsable del predio.');
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
      throw new ServiceUnavailableException(
        'El envío está deshabilitado: configure SMTP_HOST, SMTP_USER y SMTP_PASSWORD en el backend.',
      );
    }
    if (!acta.pdf) throw new NotFoundException('No hay acta PDF disponible para enviar.');
    const transporte = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
    await transporte.sendMail({
      from: MAIL_FROM ?? SMTP_USER,
      to: destinatario,
      subject: `Acta de visita de bienestar animal - ${acta.visita.predio.nombre}`,
      text: 'Adjuntamos el acta de la visita de evaluación de bienestar animal.',
      attachments: [{ filename: `acta-${visitaId}.pdf`, content: acta.pdf }],
    });
    await this.actas.update({ id: acta.id }, { correoEnviadoAt: new Date() });
    await this.dataSource.getRepository(AuditoriaModulo).insert({
      actorId: actor.id,
      modulo: 'M7',
      accion: 'ACTA_ENVIADA_CORREO',
      recursoId: visitaId,
      detalle: { correo: destinatario },
    });
    return { mensaje: 'Acta enviada al correo indicado.', correo: destinatario };
  }

  private async visitaAccesible(id: string, actor: UsuarioAutenticado): Promise<Visita> {
    const visita = await this.visitas.findOne({
      where: { id },
      relations: { predio: true, inspector: true },
    });
    if (!visita) throw new NotFoundException('Visita no encontrada.');
    if (actor.rol === Rol.INSPECTOR && visita.inspectorId !== actor.id) {
      throw new ForbiddenException('El inspector solo puede consultar sus propias visitas.');
    }
    return visita;
  }

  private async actaAccesible(
    visitaId: string,
    actor: UsuarioAutenticado,
    cargarBinarios = false,
  ): Promise<ActaVisita> {
    const consulta = this.actas.createQueryBuilder('acta')
      .leftJoinAndSelect('acta.visita', 'visita')
      .leftJoinAndSelect('visita.predio', 'predio')
      .leftJoinAndSelect('visita.inspector', 'inspector')
      .leftJoinAndSelect('acta.metodologiaVersion', 'version')
      .where('acta.visitaId = :visitaId', { visitaId });
    if (cargarBinarios) consulta.addSelect(['acta.pdf', 'acta.firma']);
    const acta = await consulta.getOne();
    if (!acta) throw new NotFoundException('No hay un acta de cierre para esta visita.');
    if (actor.rol === Rol.INSPECTOR && acta.visita.inspectorId !== actor.id) {
      throw new ForbiddenException('El inspector solo puede consultar sus propias visitas.');
    }
    return acta;
  }

  private validarRespuestas(
    respuestas: RespuestaIndicadorDto[],
    indicadores: IndicadorMetodologia[],
  ): RespuestaIndicadorDto[] {
    const porId = new Map(indicadores.map((indicador) => [indicador.id, indicador]));
    const recibidas = new Map(respuestas.map((respuesta) => [respuesta.indicadorId, respuesta]));
    if (respuestas.length !== indicadores.length || respuestas.some((r) => !porId.has(r.indicadorId))) {
      throw new UnprocessableEntityException(
        'Debe registrar una respuesta para cada indicador activo aplicable al grupo productivo.',
      );
    }
    for (const respuesta of respuestas) {
      const indicador = porId.get(respuesta.indicadorId);
      if (indicador && !puntajeDisponible(indicador, respuesta.puntaje)) {
        throw new UnprocessableEntityException(
          `El puntaje ${respuesta.puntaje} no está definido para ${indicador.nombre}.`,
        );
      }
    }
    return [...recibidas.values()];
  }

  private calcularResultado(
    grupoProductivo: string,
    respuestas: RespuestaIndicadorDto[],
    indicadores: IndicadorMetodologia[],
    pesos: PesoGrupo[],
    observaciones: string | null,
  ): ResultadoVisita {
    const respuestasPorId = new Map(respuestas.map((respuesta) => [respuesta.indicadorId, respuesta]));
    const resultadosIndicador: ResultadoIndicador[] = indicadores.map((indicador) => {
      const respuesta = respuestasPorId.get(indicador.id);
      if (!respuesta) throw new UnprocessableEntityException(`Falta puntaje para ${indicador.nombre}.`);
      const porcentaje = redondear((respuesta.puntaje / 2) * 100);
      return {
        indicadorId: indicador.id,
        clave: indicador.clave,
        nombre: indicador.nombre,
        grupoMedida: indicador.grupoMedida,
        puntaje: respuesta.puntaje,
        puntajesDisponibles: puntajesDisponibles(indicador),
        porcentaje,
        prioridad: porcentaje < 50 ? 'ALTA' : porcentaje < 75 ? 'MEDIA' : 'BAJA',
        observacion: respuesta.observacion ?? null,
      };
    });
    const resultadosGrupo = GRUPOS_MEDIDA.map((grupo) => {
      const aplicables = resultadosIndicador.filter((indicador) => indicador.grupoMedida === grupo);
      const peso = Number(pesos.find((item) => item.grupoMedida === grupo)?.porcentaje ?? 0);
      const promedio = aplicables.length
        ? redondear(aplicables.reduce((suma, indicador) => suma + indicador.porcentaje, 0) / aplicables.length)
        : 0;
      return { grupoMedida: grupo, promedio, peso, aporte: redondear((promedio * peso) / 100) };
    });
    const calificacionFinal = redondear(
      resultadosGrupo.reduce((suma, grupo) => suma + grupo.aporte, 0),
    );
    return {
      grupoProductivo,
      calificacionFinal,
      clasificacion: clasificar(calificacionFinal),
      grupos: resultadosGrupo,
      indicadores: resultadosIndicador.sort(
        (a, b) => a.porcentaje - b.porcentaje || a.nombre.localeCompare(b.nombre, 'es'),
      ),
      observaciones,
    };
  }

  private serializarIndicador(indicador: IndicadorMetodologia): FilaCatalogo {
    return {
      id: indicador.id,
      clave: indicador.clave,
      nombre: indicador.nombre,
      grupoMedida: indicador.grupoMedida,
      metodoEvaluacion: indicador.metodoEvaluacion,
      gruposProductivos: indicador.gruposProductivos,
      referenciaManual: indicador.referenciaManual,
      escalaPuntaje: indicador.escalaPuntaje,
    };
  }

  private catalogoDesdeSnapshot(snapshot: Record<string, unknown>): FilaCatalogo[] {
    const indicadores = snapshot['indicadores'];
    if (!Array.isArray(indicadores)) throw new BadRequestException('Snapshot metodológico inválido.');
    return indicadores as FilaCatalogo[];
  }

  private decodificarFirma(dataUrl: string): Buffer {
    const base64 = dataUrl.slice('data:image/png;base64,'.length);
    if (base64.length > 2_000_000) {
      throw new BadRequestException('La firma supera el tamaño permitido.');
    }
    const firma = Buffer.from(base64, 'base64');
    if (firma.length < 8 || firma.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new BadRequestException('La firma no es una imagen PNG válida.');
    }
    return firma;
  }

  private siguienteDiaHabil(desde: Date): Date {
    const fechaLocal = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(desde);
    const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
      Number(fechaLocal.find((parte) => parte.type === tipo)?.value ?? 0);
    const cursor = new Date(Date.UTC(valor('year'), valor('month') - 1, valor('day'), 12));
    do {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    } while (
      cursor.getUTCDay() === 0 ||
      cursor.getUTCDay() === 6 ||
      Boolean(this.festivosColombia.isHoliday(cursor))
    );
    return new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate(),
        valor('hour') + 5,
        valor('minute'),
        valor('second'),
      ),
    );
  }

  private async finalizarVencidas(): Promise<void> {
    const vencidas = await this.actas
      .createQueryBuilder('acta')
      .leftJoinAndSelect('acta.visita', 'visita')
      .leftJoinAndSelect('visita.predio', 'predio')
      .leftJoinAndSelect('visita.inspector', 'inspector')
      .leftJoinAndSelect('acta.metodologiaVersion', 'version')
      .addSelect(['acta.firma'])
      .where('acta.documentosPendientes = true')
      .andWhere('acta.fechaDefinitiva IS NULL')
      .andWhere('acta.venceDocumentos <= :ahora', { ahora: new Date() })
      .getMany();
    for (const acta of vencidas) await this.finalizarUna(acta, acta.venceDocumentos ?? new Date());
  }

  private async finalizarSiVencida(acta: ActaVisita): Promise<void> {
    if (
      acta.documentosPendientes &&
      !acta.fechaDefinitiva &&
      acta.venceDocumentos &&
      acta.venceDocumentos <= new Date()
    ) {
      await this.finalizarUna(acta, acta.venceDocumentos);
      acta.fechaDefinitiva = acta.venceDocumentos;
    }
  }

  private async finalizarUna(acta: ActaVisita, fecha: Date): Promise<void> {
    if (acta.fechaDefinitiva) return;
    const completa = await this.actas.createQueryBuilder('acta')
      .leftJoinAndSelect('acta.visita', 'visita')
      .leftJoinAndSelect('visita.predio', 'predio')
      .leftJoinAndSelect('visita.inspector', 'inspector')
      .leftJoinAndSelect('acta.metodologiaVersion', 'version')
      .addSelect('acta.firma')
      .where('acta.id = :id', { id: acta.id })
      .getOne();
    if (!completa || completa.fechaDefinitiva) return;
    if (!completa.firma) {
      throw new NotFoundException('No se encontró la firma del acta al finalizar su plazo.');
    }
    const pdf = await this.generarActaPdf(
      completa.visita,
      completa.resultadoSnapshot as unknown as ResultadoVisita,
      completa.metodologiaVersion.nombre,
      true,
      completa.venceDocumentos,
      fecha,
      completa.firma,
      completa.createdAt,
    );
    await this.dataSource.transaction(async (manager) => {
      const actualizados = (await manager.query(
        `UPDATE "acta_visita"
         SET "fecha_definitiva" = $1, "pdf" = $2, "updated_at" = now()
         WHERE "id" = $3 AND "fecha_definitiva" IS NULL
         RETURNING "visita_id"`,
        [fecha, pdf, acta.id],
      )) as Array<{ visita_id: string }>;
      if (actualizados.length === 0) return;
      await manager.getRepository(Visita).update(
        { id: acta.visitaId },
        { estado: EstadoVisita.CERRADA },
      );
      await manager.getRepository(AuditoriaModulo).insert({
        actorId: null,
        modulo: 'M7',
        accion: 'PLAZO_DOCUMENTOS_VENCIDO',
        recursoId: acta.visitaId,
        detalle: {
          actor: 'sistema',
          fechaDefinitiva: fecha.toISOString(),
        },
      });
    });
    acta.fechaDefinitiva = fecha;
    acta.pdf = pdf;
  }

  private async firmaDe(id: string): Promise<Buffer> {
    const acta = await this.actas.createQueryBuilder('acta')
      .addSelect('acta.firma')
      .where('acta.id = :id', { id })
      .getOne();
    if (!acta?.firma) throw new NotFoundException('No se encontró la firma de la visita.');
    return acta.firma;
  }

  private async generarActaPdf(
    visita: Visita,
    resultado: ResultadoVisita,
    version: string,
    documentosPendientes: boolean,
    vencimiento: Date | null,
    fechaDefinitiva: Date | null,
    firma: Buffer,
    fechaFirma: Date,
  ): Promise<Buffer> {
    const documento = new PDFDocument({ size: 'A4', margin: 42 });
    const partes: Buffer[] = [];
    const salida = new Promise<Buffer>((resolve, reject) => {
      documento.on('data', (parte: Buffer) => partes.push(parte));
      documento.on('end', () => resolve(Buffer.concat(partes)));
      documento.on('error', reject);
    });
    documento.fontSize(16).text('ACTA DE VISITA - BIENESTAR ANIMAL', { align: 'center' });
    documento.moveDown(0.4).fontSize(9).text(
      'Metodología EBA Aves de Corral · Instituto Colombiano Agropecuario (ICA) · versión 2.0 (2024). Uso no comercial.',
      { align: 'center' },
    );
    documento.moveDown().fontSize(11).text(`Predio: ${visita.predio.nombre}`);
    documento.text(`Municipio: ${visita.predio.municipio} · Vereda: ${visita.predio.vereda}`);
    documento.text(`Tipo: ${visita.predio.tipoPredio} · Grupo productivo: ${resultado.grupoProductivo}`);
    documento.text(`Fecha de visita: ${visita.programadaPara.toLocaleString('es-CO')}`);
    documento.text(`Inspector: ${visita.inspector.nombreCompleto}`);
    documento.text(`Versión de metodología: ${version}`);
    documento.moveDown().fontSize(13).text(
      `Calificación final: ${resultado.calificacionFinal.toFixed(2)} / 100 · ${resultado.clasificacion}`,
    );
    documento.moveDown(0.4).fontSize(11).text('Aporte por grupo de medidas');
    for (const grupo of resultado.grupos) {
      documento.fontSize(9).text(
        `${grupo.grupoMedida}: promedio ${grupo.promedio.toFixed(2)} % · peso ${grupo.peso} % · aporte ${grupo.aporte.toFixed(2)}`,
      );
    }
    documento.moveDown().fontSize(11).text('Detalle de indicadores');
    for (const indicador of resultado.indicadores) {
      if (documento.y > 710) documento.addPage();
      documento.fontSize(9).text(
        `${indicador.nombre} (${indicador.grupoMedida}): ${indicador.puntaje.toFixed(2)}/2 · ${indicador.porcentaje.toFixed(2)} % · prioridad ${indicador.prioridad}`,
      );
      if (indicador.observacion) documento.fontSize(8).text(`Observación: ${indicador.observacion}`);
    }
    if (resultado.observaciones) {
      documento.moveDown().fontSize(9).text(`Observaciones de cierre: ${resultado.observaciones}`);
    }
    if (documentosPendientes && vencimiento) {
      documento.moveDown().fontSize(10).text(
        `Documentos pendientes. Plazo para entrega: ${vencimiento.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}.`,
      );
    }
    if (fechaDefinitiva) {
      documento.moveDown().fontSize(10).text(`Calificación definitiva desde: ${fechaDefinitiva.toLocaleString('es-CO')}.`);
    }
    documento.moveDown().fontSize(10).text('Firma del inspector:');
    documento.image(firma, { fit: [190, 65] });
    documento.fontSize(8).text(
      `Firma trazada del inspector ${visita.inspector.nombreCompleto} · ${fechaFirma.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
    );
    documento.moveDown(0.5).fontSize(7).text(
      'Fuente metodológica: ICA, Metodología EBA Aves de Corral, versión 2.0, 2024. El acta contiene el resultado y snapshot metodológico de esta visita.',
    );
    documento.end();
    return salida;
  }

  private async generarPdfHistorial(
    datos: Array<Record<string, string | number>>,
  ): Promise<Buffer> {
    const documento = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    const partes: Buffer[] = [];
    const salida = new Promise<Buffer>((resolve, reject) => {
      documento.on('data', (parte: Buffer) => partes.push(parte));
      documento.on('end', () => resolve(Buffer.concat(partes)));
      documento.on('error', reject);
    });
    documento.fontSize(16).text('Historial de visitas EBA', { align: 'center' }).moveDown();
    for (const fila of datos) {
      documento.fontSize(9).text(
        `${fila.fecha} | ${fila.predio} | ${fila.tipo} | ${fila.inspector} | ${fila.grupo} | ${fila.calificacion} | ${fila.clasificacion}`,
      );
    }
    documento.end();
    return salida;
  }

  private filaHistorial(acta: ActaVisita): FilaHistorial {
    return { acta, visita: acta.visita };
  }
}

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function escalaVerificada(
  indicador: Pick<IndicadorMetodologia, 'escalaPuntaje'>,
): boolean {
  const escala = indicador.escalaPuntaje;
  return ['0', '1', '2'].every((puntaje) => {
    const texto = escala[puntaje as keyof typeof escala];
    if (typeof texto !== 'string' || !texto.trim()) return false;
    if (puntaje === '1' && texto.startsWith(PUNTAJE_NO_APLICA_PREFIX)) return true;
    return !/^Puntaje [012]\. Consultar criterio oficial/.test(texto);
  });
}

export function puntajeDisponible(
  indicador: Pick<IndicadorMetodologia, 'escalaPuntaje'>,
  puntaje: number,
): boolean {
  if (puntaje !== 0 && puntaje !== 1 && puntaje !== 2) return false;
  return puntaje !== 1 ||
    !indicador.escalaPuntaje['1'].startsWith(PUNTAJE_NO_APLICA_PREFIX);
}

function puntajesDisponibles(
  indicador: Pick<IndicadorMetodologia, 'escalaPuntaje'>,
): number[] {
  return [0, 1, 2].filter((puntaje) => puntajeDisponible(indicador, puntaje));
}
