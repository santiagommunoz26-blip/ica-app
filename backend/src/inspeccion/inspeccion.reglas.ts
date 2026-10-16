import { TipoPredio } from '../visitas/visitas.tipos.js';

/**
 * Reglas de la Fase I (M3 · RF13–RF17).
 *
 * Son funciones puras: traducen las reglas de la metodología sin depender de la
 * base de datos, para poder probarlas solas.
 */

/** A partir de cuántas aves el predio es granja (corral) (RF14). */
export const AVES_CORRAL = 200;

/** A partir de cuántas aves se evalúan dos galpones (RF16). */
export const AVES_DOS_GALPONES = 50000;

/**
 * Clasificación automática del predio (RF14): 200 aves o más es granja
 * (corral); 199 o menos, traspatio.
 */
export function clasificarPorAves(numeroAves: number): TipoPredio {
  return numeroAves >= AVES_CORRAL ? TipoPredio.CORRAL : TipoPredio.TRASPATIO;
}

/**
 * Cuántos galpones sugiere evaluar la metodología (RF16): 1 si la granja tiene
 * menos de 50.000 aves y 2 si tiene más.
 */
export function galponesSugeridos(numeroAves: number): number {
  return numeroAves >= AVES_DOS_GALPONES ? 2 : 1;
}

/** Galpón con la edad que decide cuál se prioriza (RF16). */
export interface GalponConEdad {
  edadSemanas: number | null;
}

/**
 * Ordena los galpones de mayor a menor edad y devuelve los primeros: así el
 * sistema prioriza el galpón con las aves de mayor edad (RF16). Los galpones
 * sin edad registrada quedan al final.
 */
export function priorizarPorEdad<T extends GalponConEdad>(
  galpones: readonly T[],
  cantidad: number,
): T[] {
  return [...galpones]
    .sort((uno, otro) => (otro.edadSemanas ?? -1) - (uno.edadSemanas ?? -1))
    .slice(0, Math.max(0, cantidad));
}

/**
 * Números de los galpones que la metodología sugiere evaluar (RF16): los de
 * mayor edad, hasta el número que corresponda al tamaño de la granja.
 */
export function numerosSugeridos(
  galpones: readonly (GalponConEdad & { numero: number })[],
  numeroAves: number,
): number[] {
  return priorizarPorEdad(galpones, galponesSugeridos(numeroAves)).map(
    (galpon) => galpon.numero,
  );
}
