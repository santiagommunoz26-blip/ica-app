/**
 * Vocabulario de la metodología (M3 · RF13–RF17; lo administra M8).
 *
 * Aquí viven los grupos de medidas, los grupos productivos y los sistemas de
 * producción. Los dos primeros los fijan los requisitos (RF15, RF34–RF36); la
 * lista de sistemas de producción **no** está en los documentos, así que es una
 * lista provisional del proyecto (ver `docs/CONTEXTO_PROYECTO.txt`).
 *
 * Los indicadores, sus escalas y los pesos NO se escriben en el código: viven
 * en el catálogo de la base de datos (RNF17), que M8 administra.
 */

/** Grupos de medidas de la metodología (RF34–RF36). */
export enum GrupoMedidas {
  MBA = 'MBA',
  MBR = 'MBR',
  MBG = 'MBG',
}

/** Nombre corto del grupo, como lo muestra la interfaz. */
export const ETIQUETA_GRUPO_MEDIDAS: Record<GrupoMedidas, string> = {
  [GrupoMedidas.MBA]: 'Animal (MBA)',
  [GrupoMedidas.MBR]: 'Recursos (MBR)',
  [GrupoMedidas.MBG]: 'Gestión (MBG)',
};

/** Nombre completo del grupo (RF46, «grupo de medidas»). */
export const NOMBRE_GRUPO_MEDIDAS: Record<GrupoMedidas, string> = {
  [GrupoMedidas.MBA]: 'Medidas basadas en el animal',
  [GrupoMedidas.MBR]: 'Medidas basadas en los recursos',
  [GrupoMedidas.MBG]: 'Medidas basadas en la gestión',
};

/** Orden en el que se muestran los grupos de medidas. */
export const ORDEN_GRUPOS_MEDIDAS: readonly GrupoMedidas[] = [
  GrupoMedidas.MBA,
  GrupoMedidas.MBR,
  GrupoMedidas.MBG,
];

/**
 * Grupos productivos (RF15). La metodología muestra solo los indicadores que
 * aplican al grupo elegido (RF17).
 */
export enum GrupoProductivo {
  POLLO_ENGORDE = 'POLLO_ENGORDE',
  PONEDORA_PISO = 'PONEDORA_PISO',
  PONEDORA_JAULA = 'PONEDORA_JAULA',
}

/** Etiqueta legible del grupo productivo (la del wireframe). */
export const ETIQUETA_GRUPO_PRODUCTIVO: Record<GrupoProductivo, string> = {
  [GrupoProductivo.POLLO_ENGORDE]: 'Pollo de engorde',
  [GrupoProductivo.PONEDORA_PISO]: 'Ponedora en piso o pastoreo',
  [GrupoProductivo.PONEDORA_JAULA]: 'Ponedora en jaula',
};

/** Orden en el que se ofrecen los grupos productivos. */
export const ORDEN_GRUPOS_PRODUCTIVOS: readonly GrupoProductivo[] = [
  GrupoProductivo.POLLO_ENGORDE,
  GrupoProductivo.PONEDORA_PISO,
  GrupoProductivo.PONEDORA_JAULA,
];

/**
 * Sistema de producción del predio (RF13).
 *
 * Decisión del proyecto: los documentos no traen la lista de opciones (el
 * wireframe solo muestra «Abierto mecanizado»), así que se ofrece una lista
 * provisional y corta, marcada como tal en el catálogo de la interfaz.
 */
export enum SistemaProduccion {
  PISO = 'PISO',
  PASTOREO = 'PASTOREO',
  JAULA = 'JAULA',
  ABIERTO_MECANIZADO = 'ABIERTO_MECANIZADO',
  ABIERTO_NO_MECANIZADO = 'ABIERTO_NO_MECANIZADO',
  AMBIENTE_CONTROLADO = 'AMBIENTE_CONTROLADO',
}

/** Etiqueta legible del sistema de producción. */
export const ETIQUETA_SISTEMA_PRODUCCION: Record<SistemaProduccion, string> = {
  [SistemaProduccion.PISO]: 'Piso (cama)',
  [SistemaProduccion.PASTOREO]: 'Pastoreo',
  [SistemaProduccion.JAULA]: 'Jaula',
  [SistemaProduccion.ABIERTO_MECANIZADO]: 'Abierto mecanizado',
  [SistemaProduccion.ABIERTO_NO_MECANIZADO]: 'Abierto no mecanizado',
  [SistemaProduccion.AMBIENTE_CONTROLADO]: 'Ambiente controlado',
};

/** Orden en el que se ofrecen los sistemas de producción. */
export const ORDEN_SISTEMAS_PRODUCCION: readonly SistemaProduccion[] = [
  SistemaProduccion.PISO,
  SistemaProduccion.PASTOREO,
  SistemaProduccion.JAULA,
  SistemaProduccion.ABIERTO_MECANIZADO,
  SistemaProduccion.ABIERTO_NO_MECANIZADO,
  SistemaProduccion.AMBIENTE_CONTROLADO,
];

/**
 * Forma en que se toma la muestra de un indicador (M4 · RF18, RF22).
 *
 * Los documentos fuente describen dos formas de muestreo: los 9 puntos de
 * muestreo por galpón (RF18) y las hojas centinela para las partículas en el
 * aire, con un mínimo de 3 en corral y 1 en traspatio (RF22). Cuál usa cada
 * indicador lo decide el catálogo (lo administra M8); aquí solo se declaran
 * las dos formas conocidas.
 */
export enum TipoMuestreo {
  PUNTOS_9 = 'PUNTOS_9',
  HOJAS_CENTINELA = 'HOJAS_CENTINELA',
}

/** Etiqueta legible de la forma de muestreo. */
export const ETIQUETA_TIPO_MUESTREO: Record<TipoMuestreo, string> = {
  [TipoMuestreo.PUNTOS_9]: '9 puntos de muestreo',
  [TipoMuestreo.HOJAS_CENTINELA]: 'Hojas centinela',
};

/** Opción de una lista (código + etiqueta), para enviarla a la interfaz. */
export interface OpcionCatalogo<T extends string> {
  codigo: T;
  etiqueta: string;
}
