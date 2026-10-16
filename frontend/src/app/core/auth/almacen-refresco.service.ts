import { Injectable } from '@angular/core';
import {
  aBase64,
  cifrarTexto,
  descifrarTexto,
  derivarLlave,
  desdeBase64,
  salAleatoria,
} from './cifrado';

/** Clave de almacenamiento local del token de refresco. */
const CLAVE_REFRESCO = 'ica.refresco';

/** Token guardado en claro (equipos sin PIN). */
interface RefrescoPlano {
  v: 0;
  token: string;
}

/** Token guardado cifrado con el PIN (equipos con PIN). */
interface RefrescoCifrado {
  v: 1;
  /** Sal de la llave (propia de este dato, no la del verificador del PIN). */
  sal: string;
  iv: string;
  datos: string;
}

type RefrescoGuardado = RefrescoPlano | RefrescoCifrado;

/**
 * Guarda el token de refresco en el equipo (RNF09).
 *
 * - En un equipo **con PIN**, el token se guarda cifrado con una llave derivada
 *   del PIN: sin el PIN no se puede leer, y la sesión se recupera entrando con
 *   el PIN (RF03).
 * - En un equipo **sin PIN** se guarda en claro. Es la limitación conocida: en
 *   el navegador no hay otro secreto del que derivar una llave. Queda
 *   documentada en `docs/DISENO.md` y se compensa con `https`, la caducidad
 *   corta del token y su rotación en cada uso.
 *
 * Mientras la aplicación está abierta el token también vive **en memoria**, y
 * con él la llave que lo cifró: así las renovaciones siguientes se vuelven a
 * guardar cifradas sin pedir el PIN otra vez.
 */
@Injectable({ providedIn: 'root' })
export class AlmacenRefrescoService {
  private tokenEnMemoria: string | null = null;
  private llaveEnMemoria: { llave: CryptoKey; sal: Uint8Array } | null = null;

  /** ¿Hay un token guardado pero cifrado (hace falta el PIN)? */
  bloqueadoPorPin(): boolean {
    return this.leerGuardado()?.v === 1;
  }

  /** Token disponible: el de esta sesión o el guardado en claro. */
  leer(): string | null {
    if (this.tokenEnMemoria) return this.tokenEnMemoria;
    const guardado = this.leerGuardado();
    if (guardado?.v === 0) {
      this.tokenEnMemoria = guardado.token;
      return guardado.token;
    }
    return null;
  }

  /**
   * Guarda el token. Con `pin` se cifra; sin `pin`:
   *
   * - si el equipo tiene un token cifrado y la llave está en memoria (se entró
   *   con el PIN en esta sesión), el token **rotado** se vuelve a cifrar con
   *   esa misma llave: el equipo sigue al día sin pedir el PIN otra vez;
   * - si la llave no está en memoria (por ejemplo, un ingreso con contraseña),
   *   solo queda en memoria y no se rebaja la protección existente;
   * - si el equipo no tiene token cifrado, se guarda en claro.
   */
  async guardar(token: string, pin?: string): Promise<void> {
    this.tokenEnMemoria = token;

    if (pin) {
      await this.cifrarCon(token, pin);
      return;
    }

    if (this.bloqueadoPorPin()) {
      if (this.llaveEnMemoria) await this.cifrarCon(token);
      return;
    }

    this.escribir({ v: 0, token });
  }

  /**
   * Vuelve a cifrar el token con un PIN nuevo (al configurarlo o cambiarlo).
   * Deriva siempre una llave nueva: el PIN cambió.
   */
  async reCifrarConPin(pin: string): Promise<void> {
    const token = this.leer();
    this.llaveEnMemoria = null;
    if (token) await this.cifrarCon(token, pin);
  }

  /**
   * Desbloquea el token guardado con el PIN. Devuelve `null` si no hay token
   * cifrado (equipos sin PIN) o si el PIN no corresponde.
   */
  async desbloquear(pin: string): Promise<string | null> {
    const guardado = this.leerGuardado();
    if (guardado?.v !== 1) return null;

    const sal = desdeBase64(guardado.sal);
    const llave = await derivarLlave(pin, sal);
    try {
      const token = await descifrarTexto(
        llave,
        desdeBase64(guardado.iv),
        desdeBase64(guardado.datos),
      );
      this.llaveEnMemoria = { llave, sal };
      this.tokenEnMemoria = token;
      return token;
    } catch {
      // AES-GCM no devuelve basura con una llave equivocada: falla.
      return null;
    }
  }

  /** Olvida el token de este equipo. */
  borrar(): void {
    this.tokenEnMemoria = null;
    this.llaveEnMemoria = null;
    try {
      localStorage.removeItem(CLAVE_REFRESCO);
    } catch {
      // Sin almacenamiento no hay nada que borrar.
    }
  }

  private async cifrarCon(token: string, pin?: string): Promise<void> {
    const sal = this.llaveEnMemoria?.sal ?? salAleatoria();
    let llave = this.llaveEnMemoria?.llave;
    if (!llave) {
      // Sin llave en memoria hace falta el PIN para derivarla.
      if (!pin) return;
      llave = await derivarLlave(pin, sal);
    }
    const { iv, datos } = await cifrarTexto(llave, token);
    this.llaveEnMemoria = { llave, sal };
    this.escribir({
      v: 1,
      sal: aBase64(sal),
      iv: aBase64(iv),
      datos: aBase64(datos),
    });
  }

  private leerGuardado(): RefrescoGuardado | null {
    try {
      const crudo = localStorage.getItem(CLAVE_REFRESCO);
      if (!crudo) return null;
      return JSON.parse(crudo) as RefrescoGuardado;
    } catch {
      return null;
    }
  }

  private escribir(valor: RefrescoGuardado): void {
    try {
      localStorage.setItem(CLAVE_REFRESCO, JSON.stringify(valor));
    } catch {
      // Sin almacenamiento la sesión no persiste, pero se puede seguir usando.
    }
  }
}
