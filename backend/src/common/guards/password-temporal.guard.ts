import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLAVE_PERMITE_PASSWORD_TEMPORAL } from '../decorators/password-temporal.decorator.js';
import type { UsuarioAutenticado } from '../interfaces/usuario-autenticado.interface.js';

/**
 * Bloquea el uso normal del sistema mientras el usuario tenga una contraseña
 * temporal (RF07). Solo pasan las rutas marcadas con
 * @PermitePasswordTemporal() y las públicas.
 */
@Injectable()
export class PasswordTemporalGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const permitida = this.reflector.getAllAndOverride<boolean>(
      CLAVE_PERMITE_PASSWORD_TEMPORAL,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (permitida) return true;

    const peticion = contexto
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado }>();
    const usuario = peticion.user;
    if (!usuario || usuario.debeCambiarPassword === false) return true;

    throw new ForbiddenException(
      'Debe cambiar la contraseña temporal antes de continuar.',
    );
  }
}
