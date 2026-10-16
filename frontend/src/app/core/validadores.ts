import { AbstractControl, FormArray, type ValidatorFn } from '@angular/forms';

/**
 * Valida que dos campos del mismo grupo tengan el mismo valor.
 * Se usa para confirmar la contraseña nueva.
 */
export function camposIguales(campoA: string, campoB: string): ValidatorFn {
  return (grupo: AbstractControl) => {
    const valorA = grupo.get(campoA)?.value as unknown;
    const valorB = grupo.get(campoB)?.value as unknown;
    return valorA === valorB ? null : { camposDistintos: true };
  };
}

/** Límites opcionales de un campo entero. */
export interface OpcionesEntero {
  min?: number;
  max?: number;
  requerido?: boolean;
}

/**
 * Valida un entero (cantidad de aves, número de galpón, edad en semanas).
 *
 * Cubre los errores humanos más frecuentes: letras, decimales, notación
 * científica, signos y valores fuera de rango. Un campo vacío es válido
 * salvo que se pida `requerido`.
 */
export function entero(opciones: OpcionesEntero = {}): ValidatorFn {
  return (control: AbstractControl) => {
    const crudo = control.value as unknown;
    if (estaVacio(crudo)) {
      return opciones.requerido ? { required: true } : null;
    }

    const texto =
      typeof crudo === 'number' && Number.isFinite(crudo)
        ? String(crudo)
        : String(crudo).trim();

    if (!/^-?\d+$/.test(texto)) {
      // Solo la notación científica de verdad («1e3») y los decimales («1.5»)
      // se explican como «entero»; cualquier otra cosa es texto.
      const esCientifica = /^-?\d+([.,]\d+)?e[+-]?\d+$/i.test(texto);
      const esDecimal = /^-?\d+[.,]\d+$/.test(texto);
      if (esCientifica || esDecimal) {
        return { noEntero: true };
      }
      return { noNumero: true };
    }

    const numero = Number(texto);
    if (!Number.isSafeInteger(numero)) {
      return { noEntero: true };
    }
    if (opciones.min !== undefined && numero < opciones.min) {
      return { min: { min: opciones.min, actual: numero } };
    }
    if (opciones.max !== undefined && numero > opciones.max) {
      return { max: { max: opciones.max, actual: numero } };
    }
    return null;
  };
}

/**
 * Impide que dos galpones compartan el mismo número en el formulario.
 */
export function numerosUnicos(campo = 'numero'): ValidatorFn {
  return (control: AbstractControl) => {
    if (!(control instanceof FormArray)) return null;
    const vistos = new Set<number>();
    const duplicados = new Set<number>();
    for (const grupo of control.controls) {
      const numero = valorEntero(grupo.get(campo)?.value);
      if (numero === null) continue;
      if (vistos.has(numero)) duplicados.add(numero);
      vistos.add(numero);
    }
    return duplicados.size > 0 ? { numerosDuplicados: true } : null;
  };
}

/** Convierte el valor del control a entero, o `null` si no se puede. */
export function valorEntero(valor: unknown): number | null {
  if (estaVacio(valor)) return null;
  const texto =
    typeof valor === 'number' && Number.isFinite(valor)
      ? String(valor)
      : String(valor).trim();
  if (!/^-?\d+$/.test(texto)) return null;
  const numero = Number(texto);
  return Number.isSafeInteger(numero) ? numero : null;
}

/** Mensaje concreto según el error del campo entero. */
export function mensajeEntero(
  control: AbstractControl | null | undefined,
  etiqueta: string,
  limites: { min?: number; max?: number } = {},
): string {
  const errores = control?.errors;
  if (!errores) return '';
  if (errores['required']) return `Escriba ${etiqueta}.`;
  if (errores['noNumero']) {
    return `${capitalizar(etiqueta)} solo admite números, no letras ni símbolos.`;
  }
  if (errores['noEntero']) {
    return `${capitalizar(etiqueta)} debe ser un número entero, sin decimales.`;
  }
  if (errores['min']) {
    const minimo = (errores['min'] as { min?: number }).min ?? limites.min;
    if (minimo === 0) {
      return `${capitalizar(etiqueta)} no puede ser negativo.`;
    }
    return `${capitalizar(etiqueta)} debe ser al menos ${minimo}.`;
  }
  if (errores['max']) {
    const maximo = (errores['max'] as { max?: number }).max ?? limites.max;
    return `${capitalizar(etiqueta)} no puede ser mayor que ${maximo}.`;
  }
  return `${capitalizar(etiqueta)} no es válido.`;
}

function estaVacio(valor: unknown): boolean {
  return (
    valor === null ||
    valor === undefined ||
    (typeof valor === 'string' && valor.trim() === '')
  );
}

function capitalizar(texto: string): string {
  if (texto.length === 0) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
