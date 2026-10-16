/**
 * Vocabulario de M2 · Gestión de visitas (RF08, RF09).
 *
 * Los estados y los tipos de predio los fija los requisitos; las transiciones
 * permitidas entre estados son una decisión de diseño (el documento solo dice
 * que «una visita cerrada no se puede editar, salvo por el flujo de documentos
 * pendientes», que es una propuesta).
 */

/** Estados de una visita (RF09): los cuatro del documento. */
export enum EstadoVisita {
  PROGRAMADA = 'PROGRAMADA',
  EN_CURSO = 'EN_CURSO',
  PENDIENTE_DOCUMENTOS = 'PENDIENTE_DOCUMENTOS',
  CERRADA = 'CERRADA',
}

/** Tipo de predio: granja (corral) o traspatio (RF14). */
export enum TipoPredio {
  CORRAL = 'CORRAL',
  TRASPATIO = 'TRASPATIO',
}

/**
 * Clasificación del nivel de bienestar (RF21, RF36). La calcula el motor de
 * cálculo (M6); en M2 solo se guarda y se muestra (llega como nula).
 */
export enum Clasificacion {
  EXCELENTE = 'EXCELENTE',
  ALTO = 'ALTO',
  MEDIO = 'MEDIO',
  BAJO = 'BAJO',
}

/** Etiqueta legible del estado (la interfaz muestra esta). */
export const ETIQUETA_ESTADO_VISITA: Record<EstadoVisita, string> = {
  [EstadoVisita.PROGRAMADA]: 'Programada',
  [EstadoVisita.EN_CURSO]: 'En curso',
  [EstadoVisita.PENDIENTE_DOCUMENTOS]: 'Pendiente de documentos',
  [EstadoVisita.CERRADA]: 'Cerrada',
};

/** Etiqueta legible del tipo de predio. */
export const ETIQUETA_TIPO_PREDIO: Record<TipoPredio, string> = {
  [TipoPredio.CORRAL]: 'Granja (corral)',
  [TipoPredio.TRASPATIO]: 'Traspatio',
};

/** Etiqueta legible de la clasificación. */
export const ETIQUETA_CLASIFICACION: Record<Clasificacion, string> = {
  [Clasificacion.EXCELENTE]: 'Excelente',
  [Clasificacion.ALTO]: 'Alto',
  [Clasificacion.MEDIO]: 'Medio',
  [Clasificacion.BAJO]: 'Bajo',
};

/** Orden en el que se muestran los estados (el del ciclo de la visita). */
export const ORDEN_ESTADOS_VISITA: readonly EstadoVisita[] = [
  EstadoVisita.PROGRAMADA,
  EstadoVisita.EN_CURSO,
  EstadoVisita.PENDIENTE_DOCUMENTOS,
  EstadoVisita.CERRADA,
];

/**
 * Transiciones permitidas entre estados (decisión de diseño).
 *
 * - `PROGRAMADA → EN_CURSO`: el inspector empieza la visita.
 * - `EN_CURSO → PENDIENTE_DOCUMENTOS`: faltan documentos del productor (la
 *   Fase III puede quedar para después, RF27–RF33).
 * - `PENDIENTE_DOCUMENTOS → EN_CURSO`: el productor entrega antes y la
 *   inspección continúa (la Fase III puede hacerse antes que la Fase II).
 * - `EN_CURSO → CERRADA` y `PENDIENTE_DOCUMENTOS → CERRADA`: cierre (M7).
 * - `CERRADA` es terminal: una visita cerrada no se edita (propuesta del
 *   documento de módulos).
 */
export const TRANSICIONES_ESTADO: Record<
  EstadoVisita,
  readonly EstadoVisita[]
> = {
  [EstadoVisita.PROGRAMADA]: [EstadoVisita.EN_CURSO],
  [EstadoVisita.EN_CURSO]: [
    EstadoVisita.PENDIENTE_DOCUMENTOS,
    EstadoVisita.CERRADA,
  ],
  [EstadoVisita.PENDIENTE_DOCUMENTOS]: [
    EstadoVisita.EN_CURSO,
    EstadoVisita.CERRADA,
  ],
  [EstadoVisita.CERRADA]: [],
};

/** ¿Se puede pasar de un estado a otro? (RF09) */
export function puedeCambiarEstado(
  desde: EstadoVisita,
  hacia: EstadoVisita,
): boolean {
  return TRANSICIONES_ESTADO[desde]?.includes(hacia) ?? false;
}

/** ¿La visita admite cambios? Las cerradas no se editan. */
export function esEditable(estado: EstadoVisita): boolean {
  return estado !== EstadoVisita.CERRADA;
}
