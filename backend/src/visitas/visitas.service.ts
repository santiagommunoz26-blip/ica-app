import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Brackets, ILike, Repository } from 'typeorm';
import { EstadoUsuario, Rol } from '../common/roles.js';
import { limpiarTexto } from '../common/texto.js';
import type {
  ContextoPeticion,
  UsuarioAutenticado,
} from '../common/interfaces/usuario-autenticado.interface.js';
import { RegistroAccesoService } from '../usuarios/registro-acceso.service.js';
import { EventoBitacora } from '../usuarios/entities/registro-acceso.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { InspeccionService } from '../inspeccion/inspeccion.service.js';
import { Predio } from './entities/predio.entity.js';
import { Visita } from './entities/visita.entity.js';
import { clasificar } from './calificacion.js';
import {
  aFechaEnZona,
  etiquetaMes,
  mesEnZona,
  sumarMeses,
  ultimosMeses,
} from './fechas.js';
import {
  Clasificacion,
  ETIQUETA_CLASIFICACION,
  ETIQUETA_ESTADO_VISITA,
  EstadoVisita,
  esEditable,
  puedeCambiarEstado,
} from './visitas.tipos.js';
import {
  mapearVisita,
  type VisitaConRelaciones,
} from './dto/visita-respuesta.dto.js';
import type { ActualizarVisitaDto } from './dto/actualizar-visita.dto.js';
import type { CrearVisitaDto } from './dto/crear-visita.dto.js';
import type { ListarVisitasDto } from './dto/listar-visitas.dto.js';
import type { ResumenPanelDto } from './dto/resumen-panel.dto.js';
import { PromedioGrupoDto } from './dto/resumen-panel.dto.js';
import type {
  OperacionSincronizacionDto,
  SincronizarVisitasDto,
} from './dto/sincronizar.dto.js';
import { TipoOperacionSincronizacion } from './dto/sincronizar.dto.js';

/** Cuántos meses de historia muestra la evolución del panel (RF10). */
const MESES_EVOLUCION = 6;
/** Cuántas visitas próximas muestra el panel (wireframe: tres). */
const VISITAS_PROXIMAS = 3;

/** Contexto de la petición para la bitácora (RNF11). */
type ContextoAuditoria = ContextoPeticion & { actorId?: string };

/**
 * Gestión de visitas (M2 · RF08–RF12).
 *
 * Reglas que se aplican aquí:
 * - el Inspector solo ve y gestiona **sus** visitas; el Administrador ve todas
 *   y el rol Consulta solo consulta (tabla de roles del documento de módulos,
 *   RNF07);
 * - una visita cerrada no se edita (regla del módulo M2) y el estado solo
 *   avanza por las transiciones permitidas (RF09);
 * - la creación es **idempotente** por identificador: una visita programada sin
 *   conexión puede reenviarse sin duplicarse (RF12).
 */
@Injectable()
export class VisitasService {
  constructor(
    @InjectRepository(Visita)
    private readonly visitas: Repository<Visita>,
    @InjectRepository(Predio)
    private readonly predios: Repository<Predio>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly bitacora: RegistroAccesoService,
    private readonly inspeccion: InspeccionService,
  ) {}

  // -------------------------------------------------------------- consulta

  /** Lista visitas con búsqueda, filtros, paginación y conteos por estado (RF11). */
  async listar(
    filtros: ListarVisitasDto,
    usuario: UsuarioAutenticado,
  ): Promise<{
    datos: VisitaConRelaciones[];
    total: number;
    pagina: number;
    porPagina: number;
    conteos: {
      todas: number;
      programadas: number;
      enCurso: number;
      pendientesDocumentos: number;
      cerradas: number;
    };
  }> {
    const pagina = filtros.pagina ?? 1;
    const porPagina = Math.min(filtros.porPagina ?? 20, 100);

    // Conteos para las pestañas del listado: cuántas hay de cada estado con los
    // filtros aplicados (sin contar el filtro de estado, que es la pestaña).
    const filas = await this.consultaBase(filtros, usuario)
      .select('v.estado', 'estado')
      .addSelect('COUNT(*)::int', 'cantidad')
      .groupBy('v.estado')
      .getRawMany<{ estado: EstadoVisita; cantidad: number }>();

    const porEstado = new Map(
      filas.map((fila) => [fila.estado, fila.cantidad]),
    );
    const conteos = {
      todas: filas.reduce((suma, fila) => suma + fila.cantidad, 0),
      programadas: porEstado.get(EstadoVisita.PROGRAMADA) ?? 0,
      enCurso: porEstado.get(EstadoVisita.EN_CURSO) ?? 0,
      pendientesDocumentos:
        porEstado.get(EstadoVisita.PENDIENTE_DOCUMENTOS) ?? 0,
      cerradas: porEstado.get(EstadoVisita.CERRADA) ?? 0,
    };

    const consulta = this.consultaBase(filtros, usuario);
    if (filtros.estado) {
      consulta.andWhere('v.estado = :estado', { estado: filtros.estado });
    }

    const total = await consulta.getCount();
    const datos = (await consulta
      .select(['v', 'predio', 'inspector'])
      .orderBy('v.programada_para', 'DESC')
      .addOrderBy('v.created_at', 'DESC')
      .skip((pagina - 1) * porPagina)
      .take(porPagina)
      .getMany()) as VisitaConRelaciones[];

    return { datos, total, pagina, porPagina, conteos };
  }

  /** Una visita con su predio y su inspector. */
  async buscarPorId(id: string): Promise<VisitaConRelaciones | null> {
    return this.visitas.findOne({
      where: { id },
      relations: { predio: true, inspector: true },
    });
  }

  /** La misma consulta, pero fallando si no existe (o si el rol no puede verla). */
  async exigirVisita(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<VisitaConRelaciones> {
    const visita = await this.buscarPorId(id);
    if (!visita) throw new NotFoundException('La visita no existe.');
    this.exigirAlcance(visita, usuario);
    return visita;
  }

  // ------------------------------------------------------------- creación

  /** Predios registrados, para asociar una visita (RF08). */
  listarPredios(busqueda?: string): Promise<Predio[]> {
    const texto = busqueda?.trim();
    return this.predios.find({
      where: texto
        ? [
            { nombre: ILike(`%${texto}%`) },
            { municipio: ILike(`%${texto}%`) },
            { vereda: ILike(`%${texto}%`) },
          ]
        : {},
      order: { nombre: 'ASC' },
      take: 50,
    });
  }

  /**
   * Municipios que ya aparecen en las visitas, para el filtro de RF11.
   * El catálogo de municipios propiamente dicho es de M8 (RF35); hasta
   * entonces se ofrecen los que el usuario ya usó.
   */
  async listarMunicipios(): Promise<string[]> {
    const filas = await this.predios
      .createQueryBuilder('predio')
      .select('DISTINCT predio.municipio', 'municipio')
      .orderBy('predio.municipio', 'ASC')
      .getRawMany<{ municipio: string }>();
    return filas.map((fila) => fila.municipio);
  }

  /** Programa una visita (RF08). Es idempotente por identificador (RF12). */
  async crear(
    dto: CrearVisitaDto,
    usuario: UsuarioAutenticado,
    contexto: ContextoAuditoria,
  ): Promise<VisitaConRelaciones> {
    const programadaPara = this.leerFecha(dto.programadaPara);
    const predio = await this.resolverPredio(dto);
    const inspector = await this.resolverInspector(dto.inspectorId, usuario);

    // Si el equipo reenvía una visita que ya llegó, se devuelve la que hay: así
    // una programación sin conexión no se duplica (RF12).
    const id = dto.id ?? randomUUID();
    const existente = await this.buscarPorId(id);
    if (existente) return existente;

    const visita = this.visitas.create({
      id,
      predioId: predio.id,
      inspectorId: inspector.id,
      programadaPara,
      estado: EstadoVisita.PROGRAMADA,
      observaciones: limpiarTexto(dto.observaciones ?? '') || null,
    });
    const guardada = await this.visitas.save(visita);

    await this.bitacora.registrar(EventoBitacora.VISITA_CREADA, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
      detalle: `Visita ${guardada.id} · ${predio.nombre} · ${programadaPara.toISOString()} · inspector ${inspector.correo}`,
    });

    return (await this.buscarPorId(guardada.id)) ?? visita;
  }

  /** Edita una visita programada (RF08, RF09). Las cerradas no se editan. */
  async actualizar(
    id: string,
    dto: ActualizarVisitaDto,
    usuario: UsuarioAutenticado,
    contexto: ContextoAuditoria,
  ): Promise<VisitaConRelaciones> {
    const visita = await this.exigirVisita(id, usuario);
    if (!esEditable(visita.estado)) {
      throw new ConflictException(
        'Una visita cerrada no se puede editar (solo el flujo de documentos pendientes puede cambiarla).',
      );
    }

    const cambios: string[] = [];

    if (dto.predioId && dto.predioId !== visita.predioId) {
      const predio = await this.predios.findOne({
        where: { id: dto.predioId },
      });
      if (!predio) throw new NotFoundException('El predio no existe.');
      visita.predioId = predio.id;
      cambios.push(`predio -> ${predio.nombre}`);
    }

    if (dto.inspectorId && dto.inspectorId !== visita.inspectorId) {
      const inspector = await this.resolverInspector(dto.inspectorId, usuario);
      visita.inspectorId = inspector.id;
      cambios.push(`inspector -> ${inspector.correo}`);
    }

    if (dto.programadaPara) {
      const fecha = this.leerFecha(dto.programadaPara);
      if (fecha.getTime() !== visita.programadaPara.getTime()) {
        visita.programadaPara = fecha;
        cambios.push(`fecha -> ${fecha.toISOString()}`);
      }
    }

    if (dto.observaciones !== undefined) {
      const observaciones = limpiarTexto(dto.observaciones) || null;
      if (observaciones !== visita.observaciones) {
        visita.observaciones = observaciones;
        cambios.push('observaciones');
      }
    }

    if (cambios.length === 0) return visita;

    await this.visitas.save(visita);
    await this.bitacora.registrar(EventoBitacora.VISITA_EDITADA, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
      detalle: `Visita ${visita.id} · ${cambios.join(', ')}`,
    });

    return (await this.buscarPorId(visita.id)) ?? visita;
  }

  /** Cambia el estado de una visita (RF09). Repetir el mismo estado no falla. */
  async cambiarEstado(
    id: string,
    estado: EstadoVisita,
    usuario: UsuarioAutenticado,
    contexto: ContextoAuditoria,
  ): Promise<VisitaConRelaciones> {
    const visita = await this.exigirVisita(id, usuario);

    // Idempotente: si el equipo reenvía un cambio que ya se aplicó, no es un error (RF12).
    if (visita.estado === estado) return visita;

    if (!puedeCambiarEstado(visita.estado, estado)) {
      throw new ConflictException(
        `No se puede pasar de «${ETIQUETA_ESTADO_VISITA[visita.estado]}» a «${ETIQUETA_ESTADO_VISITA[estado]}».`,
      );
    }

    const anterior = visita.estado;
    visita.estado = estado;
    await this.visitas.save(visita);

    await this.bitacora.registrar(EventoBitacora.VISITA_ESTADO_CAMBIADO, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
      detalle: `Visita ${visita.id} · ${anterior} -> ${estado}`,
    });

    return (await this.buscarPorId(visita.id)) ?? visita;
  }

  // ----------------------------------------------------------------- panel

  /** Indicadores del panel principal (RF10). */
  async resumen(usuario: UsuarioAutenticado): Promise<ResumenPanelDto> {
    const mesActual = mesEnZona(new Date());
    const mesAnterior = sumarMeses(mesActual, -1);

    const [
      visitasDelMes,
      visitasMesAnterior,
      totalVisitas,
      documentosPendientes,
      agregados,
      predios,
      filasEvolucion,
      filasClasificacion,
      proximas,
    ] = await Promise.all([
      this.contarMes(mesActual, usuario),
      this.contarMes(mesAnterior, usuario),
      this.consultaBase({}, usuario).getCount(),
      this.consultaBase({}, usuario)
        .andWhere('v.estado = :estado', {
          estado: EstadoVisita.PENDIENTE_DOCUMENTOS,
        })
        .getCount(),
      this.consultaBase({}, usuario)
        .select('AVG(v.calificacion)', 'promedio')
        .addSelect('COUNT(v.calificacion)::int', 'cantidad')
        .getRawOne<{ promedio: string | null; cantidad: number }>(),
      this.consultaBase({}, usuario)
        .select('COUNT(DISTINCT v.predio_id)::int', 'cantidad')
        .getRawOne<{ cantidad: number }>(),
      this.filasEvolucion(mesActual, usuario),
      this.filasClasificacion(usuario),
      this.visitasProximas(usuario),
    ]);

    const calificacionPromedio =
      agregados?.promedio === null ||
      agregados?.promedio === undefined ||
      agregados.cantidad === 0
        ? null
        : redondear(Number(agregados.promedio), 1);
    const clasificacionPromedio =
      calificacionPromedio === null ? null : clasificar(calificacionPromedio);

    const porMes = new Map(
      filasEvolucion.map((fila) => [
        fila.mes,
        {
          calificacion:
            fila.promedio === null ? null : redondear(Number(fila.promedio), 1),
          visitas: fila.cantidad,
        },
      ]),
    );

    const totalConResultado = filasClasificacion.reduce(
      (suma, fila) => suma + fila.cantidad,
      0,
    );
    const distribucion = ORDEN_CLASIFICACION.map((nivel) => {
      const cantidad =
        filasClasificacion.find((fila) => fila.clasificacion === nivel)
          ?.cantidad ?? 0;
      return {
        clasificacion: nivel,
        etiqueta: ETIQUETA_CLASIFICACION[nivel],
        cantidad,
        porcentaje:
          totalConResultado === 0
            ? 0
            : Math.round((cantidad / totalConResultado) * 100),
      };
    });

    return {
      visitasDelMes,
      variacionVisitas:
        visitasMesAnterior === 0
          ? null
          : Math.round(
              ((visitasDelMes - visitasMesAnterior) / visitasMesAnterior) * 100,
            ),
      calificacionPromedio,
      clasificacionPromedio,
      etiquetaClasificacionPromedio:
        clasificacionPromedio === null
          ? null
          : ETIQUETA_CLASIFICACION[clasificacionPromedio],
      documentosPendientes,
      totalVisitas,
      predios: predios?.cantidad ?? 0,
      evolucion: ultimosMeses(MESES_EVOLUCION, mesActual).map((mes) => {
        const dato = porMes.get(mes);
        return {
          mes,
          etiqueta: etiquetaMes(mes),
          calificacion: dato?.calificacion ?? null,
          visitas: dato?.visitas ?? 0,
        };
      }),
      distribucion,
      // El promedio por grupo de medidas sale del resultado del motor de cálculo
      // (M6): hasta entonces la lista llega vacía y el panel lo dice.
      promedioPorGrupo: [] as PromedioGrupoDto[],
      proximas: proximas.map(mapearVisita),
    };
  }

  // -------------------------------------------------------- sincronización

  /**
   * Aplica las operaciones hechas sin conexión (RF12).
   *
   * Cada operación se responde por separado: el lote se aplica entero aunque
   * alguna falle, y las que no se pueden aplicar se devuelven con su motivo
   * (por ejemplo, cambiar una visita que en el servidor ya está cerrada).
   */
  async sincronizar(
    dto: SincronizarVisitasDto,
    usuario: UsuarioAutenticado,
    contexto: ContextoAuditoria,
  ): Promise<{
    resultados: {
      id: string;
      estado: 'APLICADA' | 'RECHAZADA';
      motivo?: string;
    }[];
    visitas: ReturnType<typeof mapearVisita>[];
  }> {
    const resultados: {
      id: string;
      estado: 'APLICADA' | 'RECHAZADA';
      motivo?: string;
    }[] = [];
    const afectadas = new Set<string>();

    for (const operacion of dto.operaciones) {
      try {
        const id = await this.aplicarOperacion(operacion, usuario, contexto);
        afectadas.add(id);
        resultados.push({ id: operacion.id, estado: 'APLICADA' });
      } catch (fallo) {
        resultados.push({
          id: operacion.id,
          estado: 'RECHAZADA',
          motivo: motivoDeFallo(fallo),
        });
      }
    }

    const aplicadas = resultados.filter(
      (resultado) => resultado.estado === 'APLICADA',
    ).length;

    if (dto.operaciones.length > 0) {
      await this.bitacora.registrar(EventoBitacora.VISITAS_SINCRONIZADAS, {
        ...contexto,
        usuarioId: usuario.id,
        correo: usuario.correo,
        detalle: `${aplicadas} de ${dto.operaciones.length} operaciones aplicadas`,
      });
    }

    const visitas: VisitaConRelaciones[] = [];
    for (const id of afectadas) {
      const visita = await this.buscarPorId(id);
      if (visita) visitas.push(visita);
    }

    return { resultados, visitas: visitas.map(mapearVisita) };
  }

  private async aplicarOperacion(
    operacion: OperacionSincronizacionDto,
    usuario: UsuarioAutenticado,
    contexto: ContextoAuditoria,
  ): Promise<string> {
    switch (operacion.tipo) {
      case TipoOperacionSincronizacion.CREAR_VISITA: {
        if (!operacion.crear) {
          throw new BadRequestException('Falta el detalle de la visita.');
        }
        // El identificador lo propone el equipo; si viniera en la operación, se
        // usa para poder reenviarla sin duplicar (RF12).
        const detalle = operacion.crear;
        detalle.id = detalle.id ?? operacion.visitaId;
        const visita = await this.crear(detalle, usuario, contexto);
        return visita.id;
      }
      case TipoOperacionSincronizacion.ACTUALIZAR_VISITA: {
        if (!operacion.visitaId || !operacion.actualizar) {
          throw new BadRequestException('Faltan la visita o los cambios.');
        }
        const visita = await this.actualizar(
          operacion.visitaId,
          operacion.actualizar,
          usuario,
          contexto,
        );
        return visita.id;
      }
      case TipoOperacionSincronizacion.CAMBIAR_ESTADO: {
        if (!operacion.visitaId || !operacion.estado) {
          throw new BadRequestException('Faltan la visita o el estado.');
        }
        const visita = await this.cambiarEstado(
          operacion.visitaId,
          operacion.estado.estado,
          usuario,
          contexto,
        );
        return visita.id;
      }
      case TipoOperacionSincronizacion.GUARDAR_INSPECCION: {
        if (!operacion.visitaId || !operacion.inspeccion) {
          throw new BadRequestException(
            'Faltan la visita o la ficha de la inspección.',
          );
        }
        await this.inspeccion.guardar(
          operacion.visitaId,
          operacion.inspeccion,
          usuario,
          contexto,
        );
        return operacion.visitaId;
      }
      default:
        throw new BadRequestException('Tipo de operación desconocido.');
    }
  }

  // ------------------------------------------------------------- internos

  /**
   * Consulta base del listado y del panel: une el predio y el inspector y
   * aplica los filtros comunes. El alcance por rol se aplica siempre (RNF07).
   */
  private consultaBase(filtros: ListarVisitasDto, usuario: UsuarioAutenticado) {
    const consulta = this.visitas
      .createQueryBuilder('v')
      .innerJoin('v.predio', 'predio')
      .innerJoin('v.inspector', 'inspector');

    if (usuario.rol === Rol.INSPECTOR) {
      // El Inspector solo ve sus visitas (tabla de roles del documento de módulos).
      consulta.andWhere('v.inspector_id = :propio', { propio: usuario.id });
    } else if (filtros.inspectorId) {
      consulta.andWhere('v.inspector_id = :inspector', {
        inspector: filtros.inspectorId,
      });
    }

    if (filtros.municipio?.trim()) {
      consulta.andWhere('predio.municipio ILIKE :municipio', {
        municipio: `%${filtros.municipio.trim()}%`,
      });
    }

    if (filtros.tipoPredio) {
      consulta.andWhere('predio.tipo_predio = :tipoPredio', {
        tipoPredio: filtros.tipoPredio,
      });
    }

    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
      consulta.andWhere(
        new Brackets((donde) => {
          donde
            .where('predio.nombre ILIKE :busqueda', {
              busqueda: `%${busqueda}%`,
            })
            .orWhere('predio.municipio ILIKE :busqueda')
            .orWhere('predio.vereda ILIKE :busqueda')
            .orWhere('predio.nombre ILIKE :busqueda');
        }),
      );
    }

    if (filtros.desde) {
      consulta.andWhere(
        `(v.programada_para AT TIME ZONE '${ZONA_HORARIA_SQL}')::date >= :desde`,
        { desde: aFechaEnZona(filtros.desde) },
      );
    }

    if (filtros.hasta) {
      consulta.andWhere(
        `(v.programada_para AT TIME ZONE '${ZONA_HORARIA_SQL}')::date <= :hasta`,
        { hasta: aFechaEnZona(filtros.hasta) },
      );
    }

    return consulta;
  }

  /** Cuántas visitas hay programadas en un mes (RF10). */
  private contarMes(mes: string, usuario: UsuarioAutenticado): Promise<number> {
    return this.consultaBase({}, usuario)
      .andWhere(
        `to_char(v.programada_para AT TIME ZONE '${ZONA_HORARIA_SQL}', 'YYYY-MM') = :mes`,
        { mes },
      )
      .getCount();
  }

  /** Promedio de calificación por mes, para la evolución del panel (RF10). */
  private filasEvolucion(mesActual: string, usuario: UsuarioAutenticado) {
    const meses = ultimosMeses(MESES_EVOLUCION, mesActual);
    return this.consultaBase({}, usuario)
      .select(
        `to_char(v.programada_para AT TIME ZONE '${ZONA_HORARIA_SQL}', 'YYYY-MM')`,
        'mes',
      )
      .addSelect('AVG(v.calificacion)', 'promedio')
      .addSelect('COUNT(v.calificacion)::int', 'cantidad')
      .andWhere('v.calificacion IS NOT NULL')
      .andWhere(
        `to_char(v.programada_para AT TIME ZONE '${ZONA_HORARIA_SQL}', 'YYYY-MM') >= :primerMes`,
        { primerMes: meses[0] },
      )
      .groupBy(
        `to_char(v.programada_para AT TIME ZONE '${ZONA_HORARIA_SQL}', 'YYYY-MM')`,
      )
      .getRawMany<{ mes: string; promedio: string | null; cantidad: number }>();
  }

  /** Cuántas visitas hay de cada nivel, para «distribución por clasificación» (RF10). */
  private filasClasificacion(usuario: UsuarioAutenticado) {
    return this.consultaBase({}, usuario)
      .select('v.clasificacion', 'clasificacion')
      .addSelect('COUNT(*)::int', 'cantidad')
      .andWhere('v.clasificacion IS NOT NULL')
      .groupBy('v.clasificacion')
      .getRawMany<{ clasificacion: Clasificacion; cantidad: number }>();
  }

  /** Las siguientes visitas sin cerrar, de la más próxima a la más lejana (RF10). */
  private async visitasProximas(
    usuario: UsuarioAutenticado,
  ): Promise<VisitaConRelaciones[]> {
    const filas = await this.consultaBase({}, usuario)
      .andWhere('v.estado <> :cerrada', { cerrada: EstadoVisita.CERRADA })
      .andWhere(
        `(v.programada_para AT TIME ZONE '${ZONA_HORARIA_SQL}')::date >= (now() AT TIME ZONE '${ZONA_HORARIA_SQL}')::date`,
      )
      .select(['v', 'predio', 'inspector'])
      .orderBy('v.programada_para', 'ASC')
      .take(VISITAS_PROXIMAS)
      .getMany();
    return filas as VisitaConRelaciones[];
  }

  /** Convierte el texto ISO en fecha; si no es válida, responde 400. */
  private leerFecha(iso: string): Date {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('La fecha y la hora no son válidas.');
    }
    return fecha;
  }

  /** Resuelve el predio de la visita: uno existente o los datos de uno nuevo. */
  private async resolverPredio(dto: CrearVisitaDto): Promise<Predio> {
    if (dto.predioId && dto.predio) {
      throw new BadRequestException(
        'Indique un predio existente o los datos de uno nuevo, no los dos.',
      );
    }

    if (dto.predioId) {
      const predio = await this.predios.findOne({
        where: { id: dto.predioId },
      });
      if (!predio) throw new NotFoundException('El predio no existe.');
      return predio;
    }

    if (dto.predio) {
      const nombre = limpiarTexto(dto.predio.nombre);
      const municipio = limpiarTexto(dto.predio.municipio);
      // El mismo predio no se registra dos veces: si ya existe con el mismo
      // nombre y municipio, se reutiliza (útil al sincronizar, RF12).
      const existente = await this.predios.findOne({
        where: { nombre: ILike(nombre), municipio: ILike(municipio) },
      });
      if (existente) return existente;

      return this.predios.save(
        this.predios.create({
          nombre,
          municipio,
          vereda: limpiarTexto(dto.predio.vereda),
          tipoPredio: dto.predio.tipoPredio,
        }),
      );
    }

    throw new BadRequestException('Indique el predio de la visita.');
  }

  /** Resuelve y valida el inspector de la visita (RF08). */
  private async resolverInspector(
    inspectorId: string | undefined,
    usuario: UsuarioAutenticado,
  ): Promise<Usuario> {
    const id = inspectorId ?? usuario.id;

    if (usuario.rol === Rol.INSPECTOR && id !== usuario.id) {
      throw new ForbiddenException(
        'Un inspector solo programa y gestiona sus propias visitas.',
      );
    }

    const inspector = await this.usuarios.findOne({ where: { id } });
    if (!inspector)
      throw new NotFoundException('El inspector indicado no existe.');
    if (inspector.estado !== EstadoUsuario.ACTIVO) {
      throw new BadRequestException('El inspector indicado está inactivo.');
    }
    if (
      inspector.rol !== Rol.INSPECTOR &&
      inspector.rol !== Rol.ADMINISTRADOR
    ) {
      throw new BadRequestException(
        'Solo un inspector o un administrador puede quedar a cargo de una visita.',
      );
    }
    return inspector;
  }

  /** Un inspector solo puede tocar sus visitas (RNF07). */
  private exigirAlcance(
    visita: VisitaConRelaciones,
    usuario: UsuarioAutenticado,
  ): void {
    if (usuario.rol === Rol.INSPECTOR && visita.inspectorId !== usuario.id) {
      throw new ForbiddenException('Esta visita no está a su cargo.');
    }
  }
}

/** Orden en el que se muestra la distribución por clasificación (RF36). */
const ORDEN_CLASIFICACION: readonly Clasificacion[] = [
  Clasificacion.EXCELENTE,
  Clasificacion.ALTO,
  Clasificacion.MEDIO,
  Clasificacion.BAJO,
];

/**
 * Zona horaria de las agrupaciones por mes y por día. Se interpola en el SQL
 * como constante del código (nunca viene del usuario), porque Postgres no
 * acepta parámetros dentro de `AT TIME ZONE` de forma fiable.
 */
const ZONA_HORARIA_SQL = 'America/Bogota';

/** Redondea a los decimales indicados. */
function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/** Texto del fallo para devolverlo en el resultado de la sincronización. */
function motivoDeFallo(fallo: unknown): string {
  if (fallo instanceof HttpException) {
    const respuesta = fallo.getResponse();
    if (typeof respuesta === 'string') return respuesta;
    if (typeof respuesta === 'object' && respuesta !== null) {
      return (respuesta as { message?: string }).message ?? fallo.message;
    }
  }
  return 'No se pudo aplicar la operación.';
}
