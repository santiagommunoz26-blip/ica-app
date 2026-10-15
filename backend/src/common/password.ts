import { randomBytes, randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/**
 * Cifrado de contraseñas y PIN (RF01, RNF07, RNF09).
 *
 * Se usa **argon2id** (recomendación actual de OWASP), con los parámetros
 * mínimos sugeridos por OWASP: 19 MiB de memoria, 2 iteraciones y 1 hilo.
 *
 * Nota: no se indica `algorithm` porque la librería expone `Algorithm` como
 * «const enum» ambiente (incompatible con isolatedModules) y su valor por
 * defecto ya es argon2id, que es justamente el recomendado. Las pruebas
 * comprueban que el hash resultante empieza por «$argon2id$».
 */
const OPCIONES_ARGON = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/** Longitud mínima exigida a las contraseñas (decisión del proyecto). */
export const LONGITUD_MINIMA_PASSWORD = 10;

/** Longitud del PIN de acceso sin conexión (RF03). */
export const LONGITUD_PIN = 6;

/** Devuelve el hash argon2id de una contraseña o de un PIN. */
export function hashearSecreto(secreto: string): Promise<string> {
  return hash(secreto, OPCIONES_ARGON);
}

/** Compara un secreto con su hash; devuelve false si el hash no es válido. */
export async function verificarSecreto(
  hashGuardado: string,
  secreto: string,
): Promise<boolean> {
  try {
    return await verify(hashGuardado, secreto);
  } catch {
    return false;
  }
}

/**
 * Comprueba la política de contraseñas y devuelve la lista de problemas.
 * Los requisitos no fijan una política concreta (RNF07 solo pide que las
 * contraseñas se almacenen cifradas), así que esta es una decisión del
 * proyecto documentada en docs/CONTEXTO_PROYECTO.txt.
 */
export function problemasDePassword(password: string): string[] {
  const problemas: string[] = [];
  if (password.length < LONGITUD_MINIMA_PASSWORD) {
    problemas.push(
      `debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres`,
    );
  }
  if (!/[a-záéíóúñ]/.test(password))
    problemas.push('debe incluir una minúscula');
  if (!/[A-ZÁÉÍÓÚÑ]/.test(password))
    problemas.push('debe incluir una mayúscula');
  if (!/\d/.test(password)) problemas.push('debe incluir un número');
  return problemas;
}

/** Indica si una cadena es un PIN válido (solo dígitos y longitud exacta). */
export function esPinValido(pin: string): boolean {
  return new RegExp(`^\\d{${LONGITUD_PIN}}$`).test(pin);
}

/**
 * Genera una contraseña temporal aleatoria que cumple la política.
 * Se usa al crear usuarios y al restablecer su contraseña (RF05, RF07).
 */
export function generarPasswordTemporal(longitud = 12): string {
  const letrasMinusculas = 'abcdefghijkmnpqrstuvwxyz';
  const letrasMayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numeros = '23456789';
  const todos = `${letrasMinusculas}${letrasMayusculas}${numeros}`;
  const elegir = (conjunto: string): string =>
    conjunto[randomInt(0, conjunto.length)];

  const caracteres = [
    elegir(letrasMinusculas),
    elegir(letrasMayusculas),
    elegir(numeros),
  ];
  while (caracteres.length < Math.max(longitud, LONGITUD_MINIMA_PASSWORD)) {
    caracteres.push(elegir(todos));
  }
  // Baraja para que las clases obligatorias no queden siempre al principio.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

/** Genera un token opaco (para refrescar sesión o recuperar contraseña). */
export function generarTokenOpaco(): string {
  return randomBytes(48).toString('base64url');
}
