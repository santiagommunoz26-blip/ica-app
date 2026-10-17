import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { CorreoService } from '../auth/correo.service.js';
import { Rol } from '../common/roles.js';
import type {
  ContextoPeticion,
  UsuarioAutenticado,
} from '../common/interfaces/usuario-autenticado.interface.js';
import type { CatalogoActivo } from '../metodologia/dto/catalogo-respuesta.dto.js';
import {
  ETIQUETA_GRUPO_MEDIDAS,
  ETIQUETA_GRUPO_PRODUCTIVO,
  ETIQUETA_SISTEMA_PRODUCCION,
  ORDEN_GRUPOS_MEDIDAS,
} from '../metodologia/metodologia.tipos.js';
import { MetodologiaService } from '../metodologia/metodologia.service.js';
import { EventoBitacora } from '../usuarios/entities/registro-acceso.entity.js';
import { RegistroAccesoService } from '../usuarios/registro-acceso.service.js';
import type { VisitaConRelaciones } from '../visitas/dto/visita-respuesta.dto.js';
import { Visita } from '../visitas/entities/visita.entity.js';
import {
  EstadoVisita,
  esEditable,
  ETIQUETA_CLASIFICACION,
  ETIQUETA_TIPO_PREDIO,
} from '../visitas/visitas.tipos.js';
import { ActaPdfService } from './acta-pdf.service.js';
import { AlmacenamientoService } from './almacenamiento.service.js';
import {
  calcularVisitaDe,
  catalogoDeVisita,
  tipoPredioDe,
} from './calculo-visita.js';
import type { CalculoVisita } from './calculo.tipos.js';
import { calcularVencimiento, documentosPendientes } from './cierre.reglas.js';
import type { DatosActaPdf, IndicadorActa } from './cierre.tipos.js';
import type { EmitirActaDto } from './dto/emitir-acta.dto.js';
import type { EnviarActaDto } from './dto/enviar-acta.dto.js';
import {
  mapearFase4,
  type EnvioActaRespuestaDto,
  type Fase4RespuestaDto,
} from './dto/fase4-respuesta.dto.js';
import { Acta } from './entities/acta.entity.js';
import { Galpon } from './entities/galpon.entity.js';
import { Inspeccion } from './entities/inspeccion.entity.js';
import { leerDocumentos } from './fase3.tipos.js';
import type { DocumentoEvaluado } from './fase3.tipos.js';

/** Contexto de la petición para la bitácora (RNF11). */
type ContextoAuditoria = ContextoPeticion & { actorId?: string };

/** Tamaño máximo de la firma dibujada (RF42): 300 KB bastan de sobra. */
const TAMANO_MAXIMO_FIRMA = 300_000;
/** Prefijo del PNG en base64 que manda la pantalla de firma (RF42). */
const PREFIJO_PNG = 'data:image/png;base64,';
/** Bytes de la firma mágica de un PNG, para descartar archivos que no lo son. */
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Cierre y actas (M7 · RF41–RF45).
 *
 * Reglas que se aplican aquí:
 * - solo firma el inspector de la visita (tabla de roles: el acta la entrega
 *   el Inspector), y una visita cerrada no vuelve a firmarse;
 * - el cierre se firma con el cálculo completo, contando los documentos
 *   pendientes como 0 (lo que RF29 haría si no llegaran): así la acta
 *   provisional ya muestra una calificación (RF43);
 * - el plazo de documentos es 1 día hábil a las 5:00 p. m. de Colombia
 *   (`cierre.reglas.ts`) y el vencimiento se materializa al consultar la
 *   visita: la acta provisional pasa a definitiva y la calificación queda
 *   como estaba (RF44);
 * - una acta definitiva no se modifica ni se reemplaza (RNF10): el PDF vive en
 *   el almacenamiento con su huella SHA-256 y aquí quedan los metadatos;
 * - el correo al responsable (RF45) usa el transporte del proyecto (hoy,
 *   consola; las credenciales SMTP siguen pendientes con el usuario).
 */
@Injectable()
export class ActasService {
  constructor(
    @InjectRepository(Acta)
    private readonly actas: Repository<Acta>,
    @InjectRepository(Visita)
    private readonly visitas: Repository<Visita>,
    @InjectRepository(Inspeccion)
    private readonly inspecciones: Repository<Inspeccion>,
    @InjectRepository(Galpon)
    private readonly galpones: Repository<Galpon>,
    private readonly metodologia: MetodologiaService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly pdf: ActaPdfService,
    private readonly correo: CorreoService,
    private readonly bitacora: RegistroAccesoService,
  ) {}

  /**
   * Bloque del cierre (Fase IV) para la respuesta de la inspección (RF39–RF45).
   *
   * Antes de responder, materializa el vencimiento del plazo si ya pasó
   * (RF44): es lo que hace que la consulta, por sí sola, deje las cosas en su
   * sitio sin necesidad de un proceso aparte.
   */
  async estadoDe(visita: VisitaConRelaciones): Promise<Fase4RespuestaDto> {
    const inspeccion = await this.inspecciones.findOne({
      where: { visitaId: visita.id },
    });
    const galpones = inspeccion
      ? await this.galpones.find({
          where: { inspeccionId: inspeccion.id },
          order: { orden: 'ASC', numero: 'ASC' },
        })
      : [];
    const catalogo = await catalogoDeVisita(this.metodologia, inspeccion);
    // El cierre calcula con los pendientes en 0 (RF29/RF43): es la
    // calificación de la acta provisional, que se recalcula si los documentos
    // llegan a tiempo (RF44).
    const calculo = calcularVisitaDe(
      visita.predio,
      inspeccion,
      catalogo,
      galpones,
      { pendientesCuentanCero: true },
    );
    const acta = await this.revisarVencimiento(visita);

    return mapearFase4({
      calculo,
      indicadores: catalogo?.indicadores ?? [],
      documentos: leerDocumentos(inspeccion?.respuestas),
      acta,
      estado: visita.estado,
      ahora: new Date(),
    });
  }

  /**
   * Firma el acta y cierra la visita (RF41–RF43).
   *
   * Sin documentos pendientes, la visita queda cerrada y el acta nace
   * definitiva; con pendientes, la visita queda pendiente de documentos con su
   * plazo y el acta es provisional. Si ya había una provisional y los
   * documentos llegaron a tiempo, esta emisión es la nueva acta definitiva del
   * recálculo (RF44).
   */
  async emitir(
    visitaId: string,
    dto: EmitirActaDto,
    usuario: UsuarioAutenticado,
    contexto: ContextoAuditoria,
  ): Promise<Fase4RespuestaDto> {
    const visita = await this.exigirVisita(visitaId, usuario);

    const inspeccion = await this.inspecciones.findOne({
      where: { visitaId: visita.id },
    });
    if (!inspeccion) {
      throw new ConflictException(
        'La inspección todavía no ha comenzado: no hay nada que cerrar.',
      );
    }
    if (!esEditable(visita.estado)) {
      throw new ConflictException(
        'La visita ya está cerrada: su acta no se vuelve a firmar (RNF10).',
      );
    }

    const galpones = await this.galpones.find({
      where: { inspeccionId: inspeccion.id },
      order: { orden: 'ASC', numero: 'ASC' },
    });
    const catalogo = await catalogoDeVisita(this.metodologia, inspeccion);
    const calculo = calcularVisitaDe(
      visita.predio,
      inspeccion,
      catalogo,
      galpones,
      { pendientesCuentanCero: true },
    );
    if (!calculo.completo) {
      throw new ConflictException(
        'Todavía faltan indicadores sin evaluar: complete las fases antes de firmar el acta.',
      );
    }

    const documentos = leerDocumentos(inspeccion.respuestas);
    const pendientes = documentosPendientes(documentos);

    const anteriores = await this.actas.find({
      where: { visitaId: visita.id },
      order: { version: 'DESC' },
    });
    const vigente = anteriores[0] ?? null;
    if (vigente?.definitiva) {
      throw new ConflictException(
        'La visita ya tiene acta definitiva: no se modifica ni se reemplaza (RNF10).',
      );
    }
    if (vigente && pendientes.length > 0) {
      throw new ConflictException(
        'Aún hay documentos pendientes: entréguelos antes del vencimiento para recalcular y emitir el acta definitiva (RF44).',
      );
    }

    const firma = leerFirmaPng(dto.firma);
    const ahora = new Date();
    const version = (vigente?.version ?? 0) + 1;
    const definitiva = pendientes.length === 0;
    const vencimiento = definitiva ? null : calcularVencimiento(ahora);
    const id = randomUUID();
    const indicadores = this.filasActa(calculo, catalogo, documentos);

    const datos: DatosActaPdf = {
      id,
      version,
      definitiva,
      emitidaEn: ahora,
      predio: {
        nombre: visita.predio.nombre,
        municipio: visita.predio.municipio,
        vereda: visita.predio.vereda,
        etiquetaTipoPredio: ETIQUETA_TIPO_PREDIO[tipoPredioDe(visita.predio)],
        responsable: visita.predio.responsable ?? null,
        correoResponsable: visita.predio.correoResponsable ?? null,
        numeroAves: visita.predio.numeroAves ?? null,
        etiquetaSistemaProduccion: visita.predio.sistemaProduccion
          ? ETIQUETA_SISTEMA_PRODUCCION[visita.predio.sistemaProduccion]
          : null,
      },
      visita: { programadaPara: visita.programadaPara },
      inspector: usuario.nombreCompleto,
      grupoProductivo: inspeccion.grupoProductivo
        ? ETIQUETA_GRUPO_PRODUCTIVO[inspeccion.grupoProductivo]
        : null,
      galpones: galpones
        .filter((galpon) => galpon.seleccionado)
        .map((galpon) => ({
          numero: galpon.numero,
          aves: galpon.aves ?? null,
          edadSemanas: galpon.edadSemanas ?? null,
        })),
      grupos: calculo.grupos.map((grupo) => ({
        etiqueta: grupo.etiqueta,
        peso: grupo.peso,
        promedio: grupo.promedio,
        aporte: grupo.aporte,
      })),
      final: calculo.final,
      clasificacion: calculo.clasificacion
        ? ETIQUETA_CLASIFICACION[calculo.clasificacion]
        : null,
      indicadores,
      pendientes: indicadores.filter((indicador) => indicador.pendiente),
      vencimiento,
      firma,
      firmadaEn: ahora,
    };

    // El PDF se genera en el servidor y se sube al almacenamiento con su
    // huella (RNF10): el acta no depende de que el navegador la conserve.
    const pdf = await this.pdf.generar(datos);
    const huella = createHash('sha256').update(pdf).digest('hex');
    const archivo = `actas/${visita.id}/acta-v${version}.pdf`;
    const firmaArchivo = `actas/${visita.id}/firma-v${version}.png`;
    await this.almacenamiento.subir(firmaArchivo, firma, 'image/png');
    await this.almacenamiento.subir(archivo, pdf, 'application/pdf');

    const acta = await this.actas.save(
      this.actas.create({
        id,
        visitaId: visita.id,
        version,
        definitiva,
        archivo,
        huella,
        tamano: pdf.length,
        firmaArchivo,
        firmadaPorId: usuario.id,
        firmadaPorNombre: usuario.nombreCompleto,
        firmadaEn: ahora,
        documentosPendientes: pendientes.length,
        vencimientoDocumentos: vencimiento,
        calificacion: calculo.final === null ? null : calculo.final.toFixed(2),
        clasificacion: calculo.clasificacion,
        correoEnviadoEn: null,
        correoDestinatario: null,
      }),
    );

    const anterior = visita.estado;
    visita.estado = definitiva
      ? EstadoVisita.CERRADA
      : EstadoVisita.PENDIENTE_DOCUMENTOS;
    visita.calificacion =
      calculo.final === null ? null : calculo.final.toFixed(2);
    visita.clasificacion = calculo.clasificacion;
    await this.visitas.save(visita);

    await this.bitacora.registrar(EventoBitacora.ACTA_EMITIDA, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
      detalle:
        `Visita ${visita.id} · acta v${version} ` +
        (definitiva
          ? 'definitiva'
          : `provisional · ${pendientes.length} documento(s) pendiente(s) hasta ${vencimiento?.toISOString()}`) +
        ` · calificación ${acta.calificacion ?? '—'} · huella ${huella.slice(0, 12)}`,
    });
    if (anterior !== visita.estado) {
      await this.bitacora.registrar(EventoBitacora.VISITA_ESTADO_CAMBIADO, {
        ...contexto,
        usuarioId: usuario.id,
        correo: usuario.correo,
        detalle: `Visita ${visita.id} · ${anterior} -> ${visita.estado}`,
      });
    }
    if (definitiva && vigente) {
      await this.bitacora.registrar(EventoBitacora.ACTA_DEFINITIVA, {
        ...contexto,
        usuarioId: usuario.id,
        correo: usuario.correo,
        detalle: `Visita ${visita.id} · los documentos llegaron a tiempo: recalcule y acta definitiva v${version} (RF44).`,
      });
    }

    return this.estadoDe(visita);
  }

  /** Envía el acta al responsable del predio por correo (RF45). */
  async enviar(
    visitaId: string,
    dto: EnviarActaDto,
    usuario: UsuarioAutenticado,
    contexto: ContextoAuditoria,
  ): Promise<EnvioActaRespuestaDto> {
    const visita = await this.exigirVisita(visitaId, usuario);
    const acta = await this.revisarVencimiento(visita);
    if (!acta) {
      throw new ConflictException(
        'Primero firme y genere el acta de la visita (RF42).',
      );
    }

    const destinatario = (
      dto.destinatario ??
      visita.predio.correoResponsable ??
      ''
    ).trim();
    if (!destinatario) {
      throw new BadRequestException(
        'No hay correo del responsable registrado: agréguelo en la Fase I o indique un destinatario (RF45).',
      );
    }

    await this.correo.enviarActa({
      destinatario,
      responsable: visita.predio.responsable ?? null,
      predio: visita.predio.nombre,
      version: acta.version,
      definitiva: acta.definitiva,
      vencimiento: acta.vencimientoDocumentos,
    });

    const enviadoEn = new Date();
    acta.correoEnviadoEn = enviadoEn;
    acta.correoDestinatario = destinatario;
    await this.actas.save(acta);

    await this.bitacora.registrar(EventoBitacora.ACTA_ENVIADA, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
      detalle: `Visita ${visita.id} · acta v${acta.version} a ${destinatario}`,
    });

    return { destinatario, enviadoEn: enviadoEn.toISOString() };
  }

  /** URL firmada de vida corta para descargar el acta vigente (RNF22). */
  async urlDescarga(
    visitaId: string,
    usuario: UsuarioAutenticado,
  ): Promise<string> {
    const visita = await this.exigirVisita(visitaId, usuario);
    const acta = await this.revisarVencimiento(visita);
    if (!acta) {
      throw new NotFoundException(
        'La visita todavía no tiene acta firmada (RF41).',
      );
    }
    const nombre = `acta-${normalizarNombre(visita.predio.nombre)}-v${acta.version}.pdf`;
    return this.almacenamiento.urlDescarga(acta.archivo, nombre);
  }

  /**
   * Materializa el vencimiento del plazo si ya pasó (RF44).
   *
   * Si la acta vigente es provisional y su vencimiento ya pasó, la
   * calificación queda como definitiva: **esta misma acta** pasa a definitiva
   * (no se regenera: RF44 solo pide nueva acta cuando los documentos llegan a
   * tiempo) y la visita pasa a cerrada. Se ejecuta antes de consultar o editar
   * la visita (lectura perezosa), para que no entren cambios después del
   * plazo.
   */
  async revisarVencimiento(visita: Visita): Promise<Acta | null> {
    const vigente = await this.actas.findOne({
      where: { visitaId: visita.id },
      order: { version: 'DESC' },
    });
    if (!vigente || vigente.definitiva) return vigente;

    const vencimiento = vigente.vencimientoDocumentos;
    if (!vencimiento || vencimiento.getTime() > Date.now()) return vigente;

    vigente.definitiva = true;
    await this.actas.save(vigente);

    if (visita.estado === EstadoVisita.PENDIENTE_DOCUMENTOS) {
      visita.estado = EstadoVisita.CERRADA;
      if (visita.calificacion === null && vigente.calificacion !== null) {
        visita.calificacion = vigente.calificacion;
        visita.clasificacion = vigente.clasificacion;
      }
      await this.visitas.save(visita);
    }

    await this.bitacora.registrar(EventoBitacora.ACTA_DEFINITIVA, {
      usuarioId: null,
      detalle: `Visita ${visita.id} · el plazo de documentos venció (${vencimiento.toISOString()}): la calificación quedó definitiva (RF44).`,
    });
    return vigente;
  }

  /** Filas del acta: indicadores con valor, por grupo y código (RF41). */
  private filasActa(
    calculo: CalculoVisita,
    catalogo: CatalogoActivo | null,
    documentos: readonly DocumentoEvaluado[],
  ): IndicadorActa[] {
    const porCodigo = new Map(
      (catalogo?.indicadores ?? []).map((indicador) => [
        indicador.codigo,
        indicador,
      ]),
    );
    const pendientes = new Set(
      documentosPendientes(documentos).map(
        (documento) => documento.indicadorCodigo,
      ),
    );

    return calculo.indicadores
      .filter((indicador) => indicador.valor !== null)
      .slice()
      .sort(
        (izquierda, derecha) =>
          ORDEN_GRUPOS_MEDIDAS.indexOf(izquierda.grupo) -
            ORDEN_GRUPOS_MEDIDAS.indexOf(derecha.grupo) ||
          izquierda.codigo.localeCompare(derecha.codigo),
      )
      .map((indicador) => ({
        codigo: indicador.codigo,
        nombre: porCodigo.get(indicador.codigo)?.nombre ?? indicador.codigo,
        grupo: ETIQUETA_GRUPO_MEDIDAS[indicador.grupo],
        valor: indicador.valor,
        pendiente: pendientes.has(indicador.codigo),
      }));
  }

  /** Una visita con su predio y su inspector, con el alcance por rol (RNF07). */
  private async exigirVisita(
    visitaId: string,
    usuario: UsuarioAutenticado,
  ): Promise<VisitaConRelaciones> {
    const visita = await this.visitas.findOne({
      where: { id: visitaId },
      relations: { predio: true, inspector: true },
    });
    if (!visita) throw new NotFoundException('La visita no existe.');
    if (usuario.rol === Rol.INSPECTOR && visita.inspectorId !== usuario.id) {
      throw new ForbiddenException('Esta visita no está a su cargo.');
    }
    return visita as VisitaConRelaciones;
  }
}

/**
 * Lee la firma dibujada en la pantalla (RF42): PNG en base64. Se comprueba el
 * prefijo, el tamaño y la firma mágica del PNG: lo que no sea una imagen
 * pequeña y válida se rechaza con un mensaje claro.
 */
export function leerFirmaPng(dataUrl: string): Buffer {
  if (!dataUrl.startsWith(PREFIJO_PNG)) {
    throw new BadRequestException('La firma debe ser una imagen PNG (RF42).');
  }
  const contenido = dataUrl.slice(PREFIJO_PNG.length).replace(/\s/g, '');
  if (contenido.length === 0 || !/^[A-Za-z0-9+/=]+$/.test(contenido)) {
    throw new BadRequestException('La firma no tiene un formato válido.');
  }
  const firma = Buffer.from(contenido, 'base64');
  if (firma.length === 0 || firma.length > TAMANO_MAXIMO_FIRMA) {
    throw new BadRequestException(
      `La firma debe pesar menos de ${Math.round(TAMANO_MAXIMO_FIRMA / 1000)} KB.`,
    );
  }
  if (!firma.subarray(0, FIRMA_PNG.length).equals(FIRMA_PNG)) {
    throw new BadRequestException('La firma no es una imagen PNG válida.');
  }
  return firma;
}

/** Nombre de archivo seguro a partir del nombre del predio. */
function normalizarNombre(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return limpio.length > 0 ? limpio : 'predio';
}
