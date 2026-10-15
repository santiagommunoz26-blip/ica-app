import { HttpErrorResponse } from '@angular/common/http';

/**
 * Convierte el error de una petición en un mensaje que se pueda mostrar.
 * La API responde `{ message: ... }` (texto o lista de textos de validación).
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Revise su conexión a internet.';
    }

    const cuerpo = error.error as { message?: string | string[] } | null;
    const mensaje = cuerpo?.message;
    if (Array.isArray(mensaje)) return mensaje.join(' ');
    if (typeof mensaje === 'string' && mensaje.length > 0) return mensaje;

    if (error.status === 401) return 'Correo o contraseña incorrectos.';
    if (error.status === 403)
      return 'No tiene permisos para realizar esta acción.';
    if (error.status === 404)
      return 'No se encontró la información solicitada.';
    return 'Ocurrió un error inesperado. Intente de nuevo.';
  }

  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado. Intente de nuevo.';
}
