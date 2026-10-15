import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../roles.js';

/** Clave de metadatos que marca un controlador o ruta como público. */
export const CLAVE_PUBLICO = 'esPublico';

/**
 * Marca una ruta como accesible sin sesión (por ejemplo el inicio de sesión o
 * la recuperación de contraseña). El JwtAuthGuard global la deja pasar.
 */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Clave de metadatos con los roles autorizados de una ruta. */
export const CLAVE_ROLES = 'rolesPermitidos';

/**
 * Restringe una ruta a los roles indicados (RF04, RNF08).
 * Ejemplo: @Roles(Rol.ADMINISTRADOR) para la administración de usuarios.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);
