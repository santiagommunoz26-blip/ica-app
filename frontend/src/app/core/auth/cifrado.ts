/**
 * Cifrado en el equipo (RNF09).
 *
 * El único secreto que existe en el equipo de un inspector es su PIN, así que
 * las cosas que se guardan cifradas (por ahora el token de refresco) se cifran
 * con una llave derivada del PIN (PBKDF2-SHA256 → AES-GCM de 256 bits).
 *
 * Dos decisiones que conviene no perder de vista:
 * - Cada dato cifrado lleva **su propia sal** aleatoria: la sal del verificador
 *   del PIN no se reutiliza aquí (si se reutilizara, quien leyera el verificador
 *   tendría la llave).
 * - WebCrypto (`crypto.subtle`) solo existe en contexto seguro: `https` o
 *   `localhost`. En el despliegue la aplicación debe servirse por `https`.
 */

/** Iteraciones de PBKDF2 (recomendación OWASP para SHA-256). */
export const ITERACIONES_PBKDF2 = 210_000;

/** Convierte bytes a base64. */
export function aBase64(bytes: Uint8Array): string {
  let texto = '';
  bytes.forEach((byte) => {
    texto += String.fromCharCode(byte);
  });
  return btoa(texto);
}

/** Convierte base64 a bytes. */
export function desdeBase64(valor: string): Uint8Array {
  const texto = atob(valor);
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    bytes[i] = texto.charCodeAt(i);
  }
  return bytes;
}

/** Sal aleatoria de 16 bytes. */
export function salAleatoria(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/** Deriva una llave AES-GCM a partir de un secreto (el PIN) y una sal. */
export async function derivarLlave(
  secreto: string,
  sal: Uint8Array,
  iteraciones: number = ITERACIONES_PBKDF2,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: sal as BufferSource,
      iterations: iteraciones,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Cifra un texto; devuelve el vector de inicialización y los datos. */
export async function cifrarTexto(
  llave: CryptoKey,
  texto: string,
): Promise<{ iv: Uint8Array; datos: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      llave,
      new TextEncoder().encode(texto),
    ),
  );
  return { iv, datos };
}

/**
 * Descifra un texto. Lanza si la llave no es la correcta: AES-GCM comprueba la
 * autenticidad, así que un PIN equivocado no devuelve basura, falla.
 */
export async function descifrarTexto(
  llave: CryptoKey,
  iv: Uint8Array,
  datos: Uint8Array,
): Promise<string> {
  const claro = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    llave,
    datos as BufferSource,
  );
  return new TextDecoder().decode(claro);
}
