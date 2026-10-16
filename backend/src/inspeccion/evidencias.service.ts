import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { Rol } from '../common/roles.js';
import type {
  ContextoPeticion,
  UsuarioAutenticado,
} from '../common/interfaces/usuario-autenticado.interface.js';
import { RegistroAccesoService } from '../usuarios/registro-acceso.service.js';
import { EventoBitacora } from '../usuarios/entities/registro-acceso.entity.js';
import { Visita } from '../visitas/entities/visita.entity.js';
import type { VisitaConRelaciones } from '../visitas/dto/visita-respuesta.dto.js';
import { esEditable } from '../visitas/visitas.tipos.js';
import { AlmacenamientoService } from './almacenamiento.service.js';
import { Evidencia } from './entities/evidencia.entity.js';
import type { CrearEvidenciaDto } from './dto/crear-evidencia.dto.js';
import {
  mapearEvidencia,
  type EvidenciaRespuestaDto,
  type EvidenciaSubidaRespuestaDto,
} from './dto/fase2-respuesta.dto.js';

/** Contexto de la petición para la bitácora (RNF11). */
type ContextoAuditoria = ContextoPeticion & { actorId?: string };

/**
 * Evidencias de la inspección (M4 · RF23, ADR-003).
 *
 * El backend autoriza y guarda **metadatos**; el archivo lo sube el navegador
 * directo al almacenamiento con una URL firmada. Aquí se comprueba quién puede
 * subir o ver qué (RNF08, RNF22), que la visita siga editable y que el archivo
 * haya llegado de verdad antes de darlo por confirmado.
 */
@Injectable()
export class EvidenciasService {
  constructor(
    @InjectRepository(Evidencia)
    private readonly evidencias: Repository<Evidencia>,
    @InjectRepository(Visita)
    private readonly visitas: Repository<Visita>,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly bitacora: RegistroAccesoService,
  ) {}

  /** Registra la evidencia y devuelve dónde subir el archivo (RF23). */
  async crear(
    visitaId: string,
    dto: CrearEvidenciaDto,
    usuario: UsuarioAutenticado,
    contexto: ContextoAuditoria,
  ): Promise<EvidenciaSubidaRespuestaDto> {
    const visita = await this.exigirVisita(visitaId, usuario);
    if (!esEditable(visita.estado)) {
      throw new ConflictException(
        'Una visita cerrada no se puede editar; tampoco sus evidencias.',
      );
    }

    const evidencia = this.evidencias.create({
      visitaId: visita.id,
      galponNumero: dto.galponNumero ?? null,
      indicadorCodigo: dto.indicadorCodigo ?? null,
      nombre: dto.nombre,
      tipo: dto.tipo,
      tamano: dto.tamano,
      hash: dto.hash ?? null,
      ruta: `visitas/${visita.id}/${randomUUID()}${extensionDe(dto.tipo)}`,
      autorId: usuario.id,
    });
    await this.evidencias.save(evidencia);

    const urlSubida = await this.almacenamiento.urlSubida(
      evidencia.ruta,
      evidencia.tipo,
    );

    await this.bitacora.registrar(EventoBitacora.EVIDENCIA_SUBIDA, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
      detalle: `Visita ${visita.id} · ${evidencia.indicadorCodigo ?? 'sin indicador'} · ${evidencia.nombre}`,
    });

    return { evidencia: mapearEvidencia(evidencia), urlSubida };
  }

  /** Confirma que el archivo llegó al almacenamiento (ADR-003). */
  async confirmar(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<EvidenciaRespuestaDto> {
    const evidencia = await this.exigirEvidencia(id, usuario);
    if (!(await this.almacenamiento.existe(evidencia.ruta))) {
      throw new BadRequestException(
        'El archivo no llegó al almacenamiento; vuelva a subir la foto.',
      );
    }
    evidencia.confirmada = true;
    await this.evidencias.save(evidencia);
    return mapearEvidencia(evidencia);
  }

  /** URL firmada de vida corta para consultar la evidencia (RNF22). */
  async url(id: string, usuario: UsuarioAutenticado): Promise<string> {
    const evidencia = await this.exigirEvidencia(id, usuario);
    return this.almacenamiento.urlDescarga(evidencia.ruta, evidencia.nombre);
  }

  /** Borra la evidencia: primero el archivo, después los metadatos. */
  async eliminar(
    id: string,
    usuario: UsuarioAutenticado,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    const evidencia = await this.exigirEvidencia(id, usuario);
    const visita = await this.exigirVisita(evidencia.visitaId, usuario);
    if (!esEditable(visita.estado)) {
      throw new ConflictException(
        'Una visita cerrada no se puede editar; tampoco sus evidencias.',
      );
    }

    await this.almacenamiento.borrar(evidencia.ruta);
    await this.evidencias.remove(evidencia);

    await this.bitacora.registrar(EventoBitacora.EVIDENCIA_ELIMINADA, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
      detalle: `Visita ${visita.id} · ${evidencia.nombre}`,
    });
  }

  // ------------------------------------------------------------- internos

  /** La evidencia, con el alcance por rol de su visita (RNF07). */
  private async exigirEvidencia(
    id: string,
    usuario: UsuarioAutenticado,
  ): Promise<Evidencia> {
    const evidencia = await this.evidencias.findOne({ where: { id } });
    if (!evidencia) throw new NotFoundException('La evidencia no existe.');
    await this.exigirVisita(evidencia.visitaId, usuario);
    return evidencia;
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

/** Extensión del archivo según su tipo MIME (la ruta del bucket la usa). */
function extensionDe(tipo: string): string {
  switch (tipo) {
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.jpg';
  }
}
