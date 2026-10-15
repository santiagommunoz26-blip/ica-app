import type { Rol } from '../roles.js';

/** Contenido del token de acceso (JWT firmado por la API). */
export interface PayloadJwt {
  /** Identificador del usuario (claim `sub`). */
  sub: string;
  correo: string;
  rol: Rol;
}

/** Usuario de la sesión, disponible en los controladores. */
export interface UsuarioAutenticado {
  id: string;
  nombreCompleto: string;
  correo: string;
  rol: Rol;
  debeCambiarPassword: boolean;
}

/** Datos de la petición que se guardan en la bitácora (RNF11). */
export interface ContextoPeticion {
  direccionIp?: string;
  agenteUsuario?: string;
}
