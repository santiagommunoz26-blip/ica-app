import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { TokenPassword } from '../usuarios/entities/token-password.entity.js';
import { generarTokenOpaco } from '../common/password.js';
import { huellaToken } from '../common/huella-token.js';

/**
 * Tokens de un solo uso para restablecer la contraseña (RF06).
 *
 * El token que viaja por correo es aleatorio y no se guarda: en la base solo
 * queda su huella y su caducidad.
 */
@Injectable()
export class TokensPasswordService {
  constructor(
    @InjectRepository(TokenPassword)
    private readonly repositorio: Repository<TokenPassword>,
  ) {}

  /** Crea un token válido durante `minutosValidez` y devuelve el token en claro. */
  async crear(
    usuarioId: string,
    minutosValidez: number,
  ): Promise<{ token: string; expiraEn: Date }> {
    const token = generarTokenOpaco();
    const expiraEn = new Date(Date.now() + minutosValidez * 60_000);
    const registro = this.repositorio.create({
      usuarioId,
      tokenHash: huellaToken(token),
      expiraEn,
    });
    await this.repositorio.save(registro);
    return { token, expiraEn };
  }

  /** Busca un token vigente (sin usar y sin vencer) por su huella. */
  async buscarVigente(huella: string): Promise<TokenPassword | null> {
    return this.repositorio.findOne({
      where: {
        tokenHash: huella,
        usadoEn: IsNull(),
        expiraEn: MoreThan(new Date()),
      },
    });
  }

  /** Marca un token como usado (un solo uso). */
  async marcarUsado(id: string): Promise<void> {
    await this.repositorio.update(id, { usadoEn: new Date() });
  }

  /** Invalida los tokens pendientes de un usuario (por ejemplo al usarse uno). */
  async invalidarPendientes(usuarioId: string): Promise<void> {
    await this.repositorio.update(
      { usuarioId, usadoEn: IsNull() },
      { usadoEn: new Date() },
    );
  }
}
