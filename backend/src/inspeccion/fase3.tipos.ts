/**
 * Forma de las respuestas de la Fase III (M5 · RF27–RF33).
 *
 * Como la Fase II, las respuestas van en `inspeccion.respuestas` (JSONB) con
 * el snapshot de la versión del catálogo (ADR-001). La Fase III guarda, por
 * cada documento de los indicadores de gestión (MBG), su verificación: si se
 * presentó, la lista de chequeo del documento (RF28), la tasa de mortalidad
 * cuando es el indicador de mortalidad (RF30), el puntaje y si quedó pendiente
 * de entrega (RF31).
 *
 * Estas interfaces son el contrato entre lo que se guarda y lo que se calcula;
 * el frontend las espeja en `core/inspeccion/fase3.modelos.ts`.
 */

/** Verificación de un documento de gestión (M5 · RF27–RF31). */
export interface DocumentoEvaluado {
  /** Código del indicador de gestión del catálogo (RF27). */
  indicadorCodigo: string;
  /** ¿Se presentó el documento? Nulo mientras no se revise (RF27). */
  presentado: boolean | null;
  /** Legible y sin correcciones ni agregados (RF28). */
  legible: boolean;
  /** Firmado por el responsable de la granja (RF28). */
  firmadoResponsable: boolean;
  /**
   * Firma de MV/MVZ o zootecnista con matrícula vigente (RF28); nula cuando
   * el documento no la exige.
   */
  firmadoProfesional: boolean | null;
  /** Tasa de mortalidad acumulada en %; solo el indicador de mortalidad (RF30). */
  mortalidad: number | null;
  /**
   * Puntaje 0–2. Es automático cuando el documento no se presenta (0, RF29) y
   * cuando es la mortalidad, que sale de los rangos (RF30).
   */
  puntaje: number | null;
  /** Marcado para entregarlo dentro del plazo de cierre (RF31). */
  pendiente: boolean;
  /** Fecha y hora del último guardado del documento (RF26). */
  guardadoEn: string;
}

/** Contenido de `inspeccion.respuestas` que escribe la Fase III. */
export interface RespuestasFase3 {
  fase3?: {
    documentos?: DocumentoEvaluado[];
  };
}

/**
 * Lee los documentos guardados en `inspeccion.respuestas` (JSONB).
 *
 * Es defensiva: lo que hay en la base pudo escribirlo una versión anterior, así
 * que lo que no tenga la forma esperada se descarta en vez de romper la
 * pantalla.
 */
export function leerDocumentos(
  respuestas: Record<string, unknown> | null | undefined,
): DocumentoEvaluado[] {
  const fase3 = (respuestas ?? {})['fase3'];
  if (!esObjeto(fase3)) return [];
  const documentos = fase3['documentos'];
  if (!Array.isArray(documentos)) return [];

  return documentos.filter(
    (documento): documento is DocumentoEvaluado =>
      esObjeto(documento) && typeof documento['indicadorCodigo'] === 'string',
  );
}

/** Escribe los documentos en la forma que espera `inspeccion.respuestas`. */
export function escribirDocumentos(
  respuestas: Record<string, unknown> | null | undefined,
  documentos: DocumentoEvaluado[],
): Record<string, unknown> {
  return { ...respuestas, fase3: { documentos } };
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}
