import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UsuarioAutenticado } from '../interfaces/usuario-autenticado.interface.js';

/**
 * Inyecta el usuario de la sesión (cargado por la estrategia JWT).
 * Ejemplo: `cambiar(@UsuarioActual() usuario: UsuarioAutenticado)`.
 */
export const UsuarioActual = createParamDecorator(
  (_datos: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const peticion = contexto
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado }>();
    return peticion.user as UsuarioAutenticado;
  },
);
