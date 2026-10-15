import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLAVE_ROLES } from '../decorators/acceso.decorators.js';
import type { Rol } from '../roles.js';
import type { UsuarioAutenticado } from '../interfaces/usuario-autenticado.interface.js';

/**
 * Comprueba que el usuario tenga uno de los roles exigidos por la ruta
 * (RF04, RNF08). Se registra como guarda global, después del JwtAuthGuard: si
 * la ruta no declara @Roles(), solo se exige estar autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const rolesExigidos = this.reflector.getAllAndOverride<Rol[]>(CLAVE_ROLES, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!rolesExigidos?.length) return true;

    const peticion = contexto.switchToHttp().getRequest<{
      user?: UsuarioAutenticado;
    }>();
    const usuario = peticion.user;
    return !!usuario && rolesExigidos.includes(usuario.rol);
  }
}
