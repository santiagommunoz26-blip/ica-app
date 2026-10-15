import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { Sesion } from '../usuarios/entities/sesion.entity.js';

/** Datos para abrir una sesión con token de refresco. */
export interface DatosNuevaSesion {
  usuarioId: string;
  tokenHash: string;
  expiraEn: Date;
  direccionIp?: string;
  agenteUsuario?: string;
}

/**
 * Sesiones con token de refresco (RF02, RNF07): permiten cerrar sesión de
 * verdad y rotar el token en cada refresco.
 */
@Injectable()
export class SesionesService {
  constructor(
    @InjectRepository(Sesion)
    private readonly repositorio: Repository<Sesion>,
  ) {}

  /** Abre una sesión. */
  async crear(datos: DatosNuevaSesion): Promise<Sesion> {
    const sesion = this.repositorio.create({
      usuarioId: datos.usuarioId,
      tokenHash: datos.tokenHash,
      expiraEn: datos.expiraEn,
      direccionIp: datos.direccionIp ?? null,
      agenteUsuario: datos.agenteUsuario ?? null,
    });
    return this.repositorio.save(sesion);
  }

  /** Busca una sesión por la huella de su token, con el usuario asociado. */
  async buscarPorHuella(huella: string): Promise<Sesion | null> {
    return this.repositorio.findOne({
      where: { tokenHash: huella },
      relations: { usuario: true },
    });
  }

  /** Marca una sesión como revocada (cierre de sesión o rotación). */
  async revocar(sesion: Sesion): Promise<void> {
    if (sesion.revocadaEn) return;
    await this.repositorio.update(sesion.id, { revocadaEn: new Date() });
  }

  /** Revoca todas las sesiones abiertas de un usuario (por seguridad). */
  async revocarTodasDeUsuario(usuarioId: string): Promise<void> {
    await this.repositorio.update(
      { usuarioId, revocadaEn: IsNull() },
      { revocadaEn: new Date() },
    );
  }

  /**
   * Borra las sesiones ya vencidas (mantenimiento). Se puede invocar desde un
   * trabajo programado; no se ejecuta automáticamente para no complicar M1.
   */
  async limpiarVencidas(): Promise<number> {
    const resultado = await this.repositorio.delete({
      expiraEn: LessThan(new Date()),
    });
    return resultado.affected ?? 0;
  }
}
