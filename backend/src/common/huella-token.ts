import { createHash } from 'node:crypto';

/**
 * Huella de un token opaco (refresh de sesión, recuperación de contraseña).
 *
 * Los tokens se guardan en la base de datos **hasheados** con SHA-256: si la
 * base se filtra, las huellas no permiten reconstruir el token (RNF07). No se
 * usa argon2 aquí porque el token ya es aleatorio de 384 bits y se compara en
 * cada petición de refresco (debe ser rápido).
 */
export function huellaToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
