/**
 * Forma de las respuestas de la Fase II (M4 · RF18–RF26).
 *
 * Las respuestas de la inspección van en `inspeccion.respuestas` (JSONB) con
 * el snapshot de la versión del catálogo, como decidió ADR-001. La Fase II
 * guarda, por cada indicador de cada galpón, su evaluación: los puntos de
 * muestreo, el «No aplica» con su motivo y las observaciones. Las evidencias
 * (fotos) no van aquí: solo se guardan sus metadatos en la tabla `evidencia`
 * (ADR-003) y el binario vive en el almacenamiento de objetos.
 *
 * Estas interfaces son el contrato entre lo que se guarda y lo que se calcula;
 * el frontend las espeja en `core/inspeccion/fase2.modelos.ts`.
 */

/** Un punto de muestreo registrado (RF18–RF21). */
export interface PuntoEvaluado {
  /** Número del punto: 1 a 9, o 1 a N en las hojas centinela (RF18, RF22). */
  numero: number;
  /** Calificación del punto: 0, 1 o 2 (RF19); nula mientras no se califique. */
  puntaje: number | null;
  /**
   * Aves evaluadas en el punto: 15 a 30 en piso, 10 a 20 en jaula (RF20).
   * En jaula es el total de aves de las jaulas muestreadas (RF21).
   */
  aves: number | null;
  /** Jaulas muestreadas en el punto: 3 a 5 (RF20); nulo en piso. */
  jaulas: number | null;
}

/** Evaluación de un indicador en un galpón (M4 · RF18–RF26). */
export interface EvaluacionFase2 {
  /** Número del galpón evaluado (RF16). */
  galponNumero: number;
  /** Código del indicador del catálogo (RF17). */
  indicadorCodigo: string;
  /** «No aplica»: el indicador se excluye del cálculo (RF25). */
  noAplica: boolean;
  /** Motivo del «No aplica»; obligatorio cuando noAplica (RF25). */
  motivoNoAplica: string | null;
  /** Observaciones del inspector para el indicador (RF23). */
  observaciones: string | null;
  /** Puntos de muestreo registrados (RF18). */
  puntos: PuntoEvaluado[];
  /** Fecha y hora del último guardado del indicador (RF26). */
  guardadoEn: string;
}

/** Contenido de `inspeccion.respuestas` que escribe la Fase II. */
export interface RespuestasFase2 {
  fase2?: {
    evaluaciones?: EvaluacionFase2[];
  };
}

/**
 * Lee las evaluaciones guardadas en `inspeccion.respuestas` (JSONB).
 *
 * Es defensiva: lo que hay en la base pudo escribirlo una versión anterior, así
 * que lo que no tenga la forma esperada se descarta en vez de romper la
 * pantalla.
 */
export function leerEvaluaciones(
  respuestas: Record<string, unknown> | null | undefined,
): EvaluacionFase2[] {
  const fase2 = (respuestas ?? {})['fase2'];
  if (!esObjeto(fase2)) return [];
  const evaluaciones = fase2['evaluaciones'];
  if (!Array.isArray(evaluaciones)) return [];

  return evaluaciones.filter(
    (evaluacion): evaluacion is EvaluacionFase2 =>
      esObjeto(evaluacion) &&
      typeof evaluacion['galponNumero'] === 'number' &&
      typeof evaluacion['indicadorCodigo'] === 'string' &&
      Array.isArray(evaluacion['puntos']),
  );
}

/** Escribe las evaluaciones en la forma que espera `inspeccion.respuestas`. */
export function escribirEvaluaciones(
  respuestas: Record<string, unknown> | null | undefined,
  evaluaciones: EvaluacionFase2[],
): Record<string, unknown> {
  return { ...respuestas, fase2: { evaluaciones } };
}

/** Clave de una evaluación dentro de un galpón (galpón + indicador). */
export function claveEvaluacion(
  galponNumero: number,
  indicadorCodigo: string,
): string {
  return `${galponNumero}|${indicadorCodigo}`;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}
