import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rol } from '../common/roles.js';
import { limpiarTexto } from '../common/texto.js';
import type {
  ContextoPeticion,
  UsuarioAutenticado,
} from '../common/interfaces/usuario-autenticado.interface.js';
import { MetodologiaService } from '../metodologia/metodologia.service.js';
import {
  catalogoVacio,
  mapearCatalogo,
} from '../metodologia/dto/catalogo-respuesta.dto.js';
import { RegistroAccesoService } from '../usuarios/registro-acceso.service.js';
import { EventoBitacora } from '../usuarios/entities/registro-acceso.entity.js';
import { Predio } from '../visitas/entities/predio.entity.js';
import { Visita } from '../visitas/entities/visita.entity.js';
import type { VisitaConRelaciones } from '../visitas/dto/visita-respuesta.dto.js';
import { esEditable } from '../visitas/visitas.tipos.js';
import { Inspeccion } from './entities/inspeccion.entity.js';
import { Galpon } from './entities/galpon.entity.js';
import { clasificarPorAves } from './inspeccion.reglas.js';
import {
  mapearInspeccion,
  type InspeccionRespuestaDto,
} from './dto/inspeccion-respuesta.dto.js';
import type { GuardarInspeccionDto } from './dto/guardar-inspeccion.dto.js';

/** Contexto de la petición para la bitácora (RNF11). */
type ContextoAuditoria = ContextoPeticion & { actorId?: string };

/**
 * Apertura y ficha general, Fase I (M3 · RF13–RF17).
 *
 * Reglas que se aplican aquí:
 * - el Inspector solo diligencia **sus** visitas; los demás roles solo
 *   consultan (tabla de roles del documento de módulos);
 * - una visita cerrada no se edita (regla de M2), así que su ficha tampoco;
 * - el predio se clasifica por el número de aves (RF14) y los pesos salen del
 *   catálogo, no del código (RNF17);
 * - guardar es idempotente por visita: reenviar el mismo borrador no duplica
 *   nada (RF12).
 */
@Injectable()
export class InspeccionService {
  constructor(
    @InjectRepository(Visita)
    private readonly visitas: Repository<Visita>,
    @InjectRepository(Predio)
    private readonly predios: Repository<Predio>,
    @InjectRepository(Inspeccion)
    private readonly inspecciones: Repository<Inspeccion>,
    @InjectRepository(Galpon)
    private readonly galpones: Repository<Galpon>,
    private readonly metodologia: MetodologiaService,
    private readonly bitacora: RegistroAccesoService,
  ) {}

  /** Ficha y catálogo de la visita (RF13–RF17). */
  async obtener(
    visitaId: string,
    usuario: UsuarioAutenticado,
  ): Promise<InspeccionRespuestaDto> {
    const visita = await this.exigirVisita(visitaId, usuario);
    return this.armarRespuesta(visita);
  }

  /**
   * Guarda el borrador de la Fase I (RF13–RF16). Crea la inspección si es la
   * primera vez y reemplaza los galpones enviados.
   */
  async guardar(
    visitaId: string,
    dto: GuardarInspeccionDto,
    usuario: UsuarioAutenticado,
    contexto: ContextoAuditoria,
  ): Promise<InspeccionRespuestaDto> {
    const visita = await this.exigirVisita(visitaId, usuario);
    if (!esEditable(visita.estado)) {
      throw new ConflictException(
        'Una visita cerrada no se puede editar; su ficha tampoco.',
      );
    }

    await this.actualizarPredio(visita.predio, dto);

    const catalogo = await this.metodologia.activa();
    let inspeccion = await this.inspecciones.findOne({
      where: { visitaId: visita.id },
    });
    if (!inspeccion) {
      inspeccion = this.inspecciones.create({
        visitaId: visita.id,
        metodologiaId: catalogo?.metodologia.id ?? null,
        fechaHora: visita.programadaPara,
      });
    } else if (!inspeccion.metodologiaId && catalogo) {
      inspeccion.metodologiaId = catalogo.metodologia.id;
    }

    if (dto.grupoProductivo !== undefined) {
      inspeccion.grupoProductivo = dto.grupoProductivo;
    }
    if (dto.fechaHora !== undefined) {
      inspeccion.fechaHora = this.leerFecha(dto.fechaHora);
    }
    if (dto.observaciones !== undefined) {
      inspeccion.observaciones = limpiarTexto(dto.observaciones) || null;
    }
    inspeccion = await this.inspecciones.save(inspeccion);

    if (dto.galpones) {
      await this.reemplazarGalpones(inspeccion.id, dto.galpones);
    }

    await this.bitacora.registrar(EventoBitacora.INSPECCION_GUARDADA, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
      detalle: `Visita ${visita.id} · Fase I · ${visita.predio.nombre}`,
    });

    return this.armarRespuesta(visita);
  }

  // ------------------------------------------------------------- internos

  /** Arma la respuesta con lo que hay guardado y el catálogo que le toca. */
  private async armarRespuesta(
    visita: VisitaConRelaciones,
  ): Promise<InspeccionRespuestaDto> {
    const inspeccion = await this.inspecciones.findOne({
      where: { visitaId: visita.id },
    });

    const galpones = inspeccion
      ? await this.galpones.find({
          where: { inspeccionId: inspeccion.id },
          order: { orden: 'ASC', numero: 'ASC' },
        })
      : [];

    const catalogoActivo = inspeccion?.metodologiaId
      ? await this.metodologia.porId(inspeccion.metodologiaId)
      : await this.metodologia.activa();
    const catalogo = catalogoActivo
      ? mapearCatalogo(catalogoActivo)
      : catalogoVacio();

    return mapearInspeccion(visita, inspeccion ?? null, galpones, catalogo);
  }

  /** Aplica la ficha del predio y reclasifica por el número de aves (RF13, RF14). */
  private async actualizarPredio(
    predio: Predio,
    dto: GuardarInspeccionDto,
  ): Promise<void> {
    const cambios: string[] = [];

    if (dto.nombrePredio !== undefined) {
      const nombre = limpiarTexto(dto.nombrePredio);
      if (nombre !== predio.nombre) {
        predio.nombre = nombre;
        cambios.push('nombre');
      }
    }
    if (dto.municipio !== undefined) {
      const municipio = limpiarTexto(dto.municipio);
      if (municipio !== predio.municipio) {
        predio.municipio = municipio;
        cambios.push('municipio');
      }
    }
    if (dto.vereda !== undefined) {
      const vereda = limpiarTexto(dto.vereda);
      if (vereda !== predio.vereda) {
        predio.vereda = vereda;
        cambios.push('vereda');
      }
    }
    if (dto.responsable !== undefined) {
      const responsable = limpiarTexto(dto.responsable) || null;
      if (responsable !== predio.responsable) {
        predio.responsable = responsable;
        cambios.push('responsable');
      }
    }
    if (dto.sistemaProduccion !== undefined) {
      if (dto.sistemaProduccion !== predio.sistemaProduccion) {
        predio.sistemaProduccion = dto.sistemaProduccion;
        cambios.push('sistema de producción');
      }
    }
    if (dto.numeroAves !== undefined) {
      if (dto.numeroAves !== predio.numeroAves) {
        predio.numeroAves = dto.numeroAves;
        cambios.push('número de aves');
      }
      // El número de aves confirma el tipo (RF14).
      const clasificado = clasificarPorAves(dto.numeroAves);
      if (clasificado !== predio.tipoPredio) {
        predio.tipoPredio = clasificado;
        cambios.push('tipo de predio');
      }
    }

    if (cambios.length > 0) await this.predios.save(predio);
  }

  /** Reemplaza los galpones de la inspección, conservando los que siguen (RF16). */
  private async reemplazarGalpones(
    inspeccionId: string,
    galpones: GuardarInspeccionDto['galpones'],
  ): Promise<void> {
    const enviados = galpones ?? [];
    const numeros = new Set<number>();
    for (const galpon of enviados) {
      if (numeros.has(galpon.numero)) {
        throw new BadRequestException(
          `El galpón ${galpon.numero} está repetido.`,
        );
      }
      numeros.add(galpon.numero);
    }

    const existentes = await this.galpones.find({
      where: { inspeccionId },
    });
    const porNumero = new Map(
      existentes.map((galpon) => [galpon.numero, galpon]),
    );

    const guardar = enviados.map((datos, indice) => {
      const galpon =
        porNumero.get(datos.numero) ??
        this.galpones.create({ inspeccionId, numero: datos.numero });
      galpon.edadSemanas = datos.edadSemanas ?? null;
      galpon.aves = datos.aves ?? null;
      galpon.seleccionado = datos.seleccionado ?? false;
      galpon.orden = indice;
      return galpon;
    });

    const sobrantes = existentes.filter(
      (galpon) => !numeros.has(galpon.numero),
    );
    if (sobrantes.length > 0) await this.galpones.remove(sobrantes);
    if (guardar.length > 0) await this.galpones.save(guardar);
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

  /** Convierte el texto ISO en fecha; si no es válida, responde 400. */
  private leerFecha(iso: string): Date {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('La fecha y la hora no son válidas.');
    }
    return fecha;
  }
}
