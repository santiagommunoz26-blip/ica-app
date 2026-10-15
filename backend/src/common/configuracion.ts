import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

const logger = new Logger('Configuracion');

/**
 * Secreto efímero de desarrollo. Se calcula una sola vez por proceso para que
 * el firmante (JwtService) y el verificador (JwtStrategy) coincidan.
 */
let secretoEfimero: string | undefined;

/**
 * Devuelve el secreto para firmar los JWT (RNFG06: las llaves viven en
 * variables de entorno / Secret Manager, nunca en el repositorio).
 *
 * - Si JWT_SECRETO está definido (mínimo 32 caracteres) se usa.
 * - En producción es obligatorio: si falta, se detiene el arranque.
 * - En desarrollo se genera uno aleatorio y se avisa por consola (los tokens
 *   dejan de ser válidos al reiniciar, algo aceptable en local).
 */
export function secretoJwt(config: ConfigService): string {
  const definido = config.get<string>('JWT_SECRETO');
  if (definido && definido.length >= 32) return definido;

  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error(
      'Falta la variable JWT_SECRETO (mínimo 32 caracteres). En producción el secreto es obligatorio.',
    );
  }

  if (!secretoEfimero) {
    secretoEfimero = randomBytes(48).toString('base64url');
    logger.warn(
      'JWT_SECRETO no está definido: se usa un secreto aleatorio temporal (solo para desarrollo). Los tokens dejarán de ser válidos al reiniciar el backend.',
    );
  }
  return secretoEfimero;
}
