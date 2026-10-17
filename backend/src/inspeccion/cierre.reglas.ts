import type { DocumentoEvaluado } from './fase3.tipos.js';

/**
 * Reglas del cierre y del acta (M7 · RF39–RF45), aisladas y probables.
 *
 * Tres reglas viven aquí:
 *
 * 1. La **prioridad de mejora** de un indicador (RF40), que el wireframe
 *    muestra en tres niveles («Prioridad alta», «Prioridad media» y «Sin
 *    prioridad»): los umbrales son una interpretación a partir de los
 *    ejemplos del wireframe (58 % alta, 75 % media, 100 % sin prioridad) y
 *    quedan pendientes de la aprobación del usuario.
 * 2. Los **documentos pendientes** de la Fase III (RF31), que al cierre
 *    activan el plazo (RF43).
 * 3. El **vencimiento del plazo**: 1 día hábil a las 5:00 p. m. de Colombia
 *    (RF43). El cómputo es una interpretación: se cuenta el siguiente día
 *    hábil (lunes a viernes) al de la firma, sin calendario de festivos
 *    colombianos (pendiente de aprobación) y sin horario de verano (Colombia
 *    no lo tiene: el desplazamiento es fijo, −05:00).
 */

/** Prioridad de mejora de un indicador (RF40). */
export type PrioridadMejora = 'ALTA' | 'MEDIA' | 'SIN_PRIORIDAD';

/** Etiquetas de la prioridad, como las muestra el wireframe (RF40). */
export const ETIQUETA_PRIORIDAD: Record<PrioridadMejora, string> = {
  ALTA: 'Prioridad alta',
  MEDIA: 'Prioridad media',
  SIN_PRIORIDAD: 'Sin prioridad',
};

/**
 * Umbrales de la prioridad (RF40): por debajo de 60 % la mejora es de
 * prioridad alta; de 60 % a menos de 80 %, media; de 80 % en adelante, sin
 * prioridad. Interpretación a partir del wireframe (58 % alta, 75 % media,
 * 100 % sin prioridad), pendiente de aprobación.
 */
export const UMBRAL_PRIORIDAD_ALTA = 60;
export const UMBRAL_PRIORIDAD_MEDIA = 80;

/** Clasifica el valor de un indicador (0–100) por prioridad de mejora (RF40). */
export function prioridadDeMejora(valor: number): PrioridadMejora {
  if (valor < UMBRAL_PRIORIDAD_ALTA) return 'ALTA';
  if (valor < UMBRAL_PRIORIDAD_MEDIA) return 'MEDIA';
  return 'SIN_PRIORIDAD';
}

/** Documentos de la Fase III marcados pendientes de entrega (RF31, RF43). */
export function documentosPendientes(
  documentos: readonly DocumentoEvaluado[],
): DocumentoEvaluado[] {
  return documentos.filter((documento) => documento.pendiente === true);
}

/** Hora del vencimiento en Colombia: 5:00 p. m. (el wireframe de la Fase IV). */
export const HORA_VENCIMIENTO = 17;

/** Colombia no tiene horario de verano: el desplazamiento es fijo (−05:00). */
const DESPLAZAMIENTO_BOGOTA_MS = 5 * 60 * 60 * 1000;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Vencimiento del plazo de documentos pendientes (RF43): el siguiente día
 * hábil (lunes a viernes) al de la firma del acta, a las 5:00 p. m. de
 * Colombia. Si la firma cae en fin de semana, el plazo corre hasta el lunes.
 *
 * Interpretación pendiente de aprobación: no se descuentan los festivos
 * colombianos porque la metodología y los documentos no traen ese calendario.
 */
export function calcularVencimiento(firma: Date): Date {
  const enBogota = new Date(firma.getTime() - DESPLAZAMIENTO_BOGOTA_MS);
  let diaMs = Date.UTC(
    enBogota.getUTCFullYear(),
    enBogota.getUTCMonth(),
    enBogota.getUTCDate(),
  );

  do {
    diaMs += UN_DIA_MS;
  } while (!esDiaHabil(diaMs));

  return new Date(
    diaMs + HORA_VENCIMIENTO * 60 * 60 * 1000 + DESPLAZAMIENTO_BOGOTA_MS,
  );
}

/** ¿La medianoche UTC del día indicado es un día hábil (lunes a viernes)? */
function esDiaHabil(diaMs: number): boolean {
  const dia = new Date(diaMs).getUTCDay();
  return dia >= 1 && dia <= 5;
}
