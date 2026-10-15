import { Injectable } from '@angular/core';

/** Clave de almacenamiento local del verificador del PIN. */
const CLAVE_PIN = 'ica.pin';
/** Iteraciones de PBKDF2 (recomendación OWASP para SHA-256). */
const ITERACIONES = 210_000;
/** Intentos fallidos permitidos antes de bloquear el acceso con PIN. */
export const MAX_INTENTOS_PIN = 5;

/** Verificador de PIN guardado en el equipo. */
interface PinGuardado {
  correo: string;
  /** Sal aleatoria, en base64. */
  sal: string;
  /** Derivación PBKDF2 del PIN, en base64. Nunca se guarda el PIN. */
  verificador: string;
  iteraciones: number;
  intentosFallidos: number;
  actualizadoEn: string;
}

/**
 * PIN de acceso sin conexión (RF03).
 *
 * El PIN nunca se guarda en claro ni se envía al servidor desde aquí: en el
 * equipo se guarda solo una derivación PBKDF2 (WebCrypto) que permite
 * comprobarlo sin internet. El servidor guarda su propio hash argon2id para
 * verificarlo cuando hay conexión.
 *
 * Límite de intentos: tras MAX_INTENTOS_PIN fallos, el acceso con PIN queda
 * bloqueado en el equipo hasta que el usuario entre con su contraseña
 * (decisión del proyecto, registrada en ADR-002).
 */
@Injectable({ providedIn: 'root' })
export class PinOfflineService {
  /** ¿Hay un PIN configurado en este equipo? */
  hayPin(): boolean {
    return this.leer() !== null;
  }

  /** Correo del usuario para el que se configuró el PIN. */
  correoDelPin(): string | null {
    return this.leer()?.correo ?? null;
  }

  /** ¿Está bloqueado por demasiados intentos fallidos? */
  bloqueado(): boolean {
    const guardado = this.leer();
    return !!guardado && guardado.intentosFallidos >= MAX_INTENTOS_PIN;
  }

  /** Intentos que quedan antes del bloqueo. */
  intentosRestantes(): number {
    const guardado = this.leer();
    if (!guardado) return MAX_INTENTOS_PIN;
    return Math.max(0, MAX_INTENTOS_PIN - guardado.intentosFallidos);
  }

  /** Guarda (o reemplaza) el PIN del equipo para un correo. */
  async guardar(pin: string, correo: string): Promise<void> {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const verificador = await this.derivar(pin, sal, ITERACIONES);
    this.escribir({
      correo,
      sal: aBase64(sal),
      verificador,
      iteraciones: ITERACIONES,
      intentosFallidos: 0,
      actualizadoEn: new Date().toISOString(),
    });
  }

  /**
   * Comprueba el PIN. Si es incorrecto suma un intento fallido; si es
   * correcto lo reinicia.
   */
  async verificar(pin: string): Promise<boolean> {
    const guardado = this.leer();
    if (!guardado) return false;
    if (guardado.intentosFallidos >= MAX_INTENTOS_PIN) return false;

    const derivado = await this.derivar(
      pin,
      desdeBase64(guardado.sal),
      guardado.iteraciones,
    );
    const correcto = derivado === guardado.verificador;

    this.escribir({
      ...guardado,
      intentosFallidos: correcto ? 0 : guardado.intentosFallidos + 1,
    });
    return correcto;
  }

  /** Olvida el PIN de este equipo (por ejemplo al cerrar sesión del todo). */
  olvidar(): void {
    try {
      localStorage.removeItem(CLAVE_PIN);
    } catch {
      // Si el almacenamiento no está disponible no hay nada que borrar.
    }
  }

  /** Deriva el PIN con PBKDF2-SHA256 y devuelve el resultado en base64. */
  private async derivar(
    pin: string,
    sal: Uint8Array,
    iteraciones: number,
  ): Promise<string> {
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(pin),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: sal as BufferSource,
        iterations: iteraciones,
        hash: 'SHA-256',
      },
      material,
      256,
    );
    return aBase64(new Uint8Array(bits));
  }

  private leer(): PinGuardado | null {
    try {
      const crudo = localStorage.getItem(CLAVE_PIN);
      if (!crudo) return null;
      return JSON.parse(crudo) as PinGuardado;
    } catch {
      return null;
    }
  }

  private escribir(valor: PinGuardado): void {
    try {
      localStorage.setItem(CLAVE_PIN, JSON.stringify(valor));
    } catch {
      // Sin almacenamiento no se puede mantener el PIN sin conexión.
    }
  }
}

/** Convierte bytes a base64. */
function aBase64(bytes: Uint8Array): string {
  let texto = '';
  bytes.forEach((byte) => {
    texto += String.fromCharCode(byte);
  });
  return btoa(texto);
}

/** Convierte base64 a bytes. */
function desdeBase64(valor: string): Uint8Array {
  const texto = atob(valor);
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    bytes[i] = texto.charCodeAt(i);
  }
  return bytes;
}
