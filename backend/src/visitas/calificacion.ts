import { Clasificacion } from './visitas.tipos.js';

/**
 * Clasificación de un puntaje 0–100 (RF21, RF36).
 *
 * Regla de la metodología (PDF): Excelente 90 % o más; Alto 75 % o más y menos
 * de 90 %; Medio 50 % o más y menos de 75 %; Bajo menos de 50 %.
 *
 * Aquí solo se traduce un puntaje ya calculado a su nivel (lo que el panel
 * necesita para etiquetar el promedio). El motor de cálculo completo —pesos,
 * indicadores y grupos— es M6.
 */
export function clasificar(puntaje: number): Clasificacion {
  if (puntaje >= 90) return Clasificacion.EXCELENTE;
  if (puntaje >= 75) return Clasificacion.ALTO;
  if (puntaje >= 50) return Clasificacion.MEDIO;
  return Clasificacion.BAJO;
}
