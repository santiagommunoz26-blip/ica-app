/**
 * Formas del cierre y del acta (M7 · RF39–RF45).
 *
 * El cierre reúne lo que dejaron las fases anteriores: el resultado del motor
 * (M6), los documentos pendientes de la Fase III (M5) y los datos de la ficha
 * (M3). Estas interfaces son el contrato entre el servicio de actas, el
 * renderizado del PDF y la respuesta de la API; el frontend las espeja en
 * `core/inspeccion/fase4.modelos.ts`.
 */

/** Indicador evaluado para el acta y la pantalla de cierre (RF39–RF41). */
export interface IndicadorActa {
  codigo: string;
  nombre: string;
  /** Etiqueta del grupo de medidas (Animal, Recursos, Gestión). */
  grupo: string;
  /** Valor en % (0–100); nulo sin valor. */
  valor: number | null;
  /** Documento pendiente de entrega, si es un indicador de gestión (RF31). */
  pendiente: boolean;
}

/** Aporte de un grupo de medidas en el acta (RF39). */
export interface GrupoActa {
  etiqueta: string;
  peso: number;
  promedio: number | null;
  aporte: number | null;
}

/**
 * Datos congelados para renderizar el PDF del acta (RF41).
 *
 * Se arman en el momento de la emisión: el acta refleja lo que había cuando se
 * firmó, aunque la inspección siga cambiando después (la definitiva no se
 * modifica: RNF10).
 */
export interface DatosActaPdf {
  id: string;
  version: number;
  definitiva: boolean;
  emitidaEn: Date;
  predio: {
    nombre: string;
    municipio: string;
    vereda: string;
    etiquetaTipoPredio: string;
    responsable: string | null;
    correoResponsable: string | null;
    numeroAves: number | null;
    etiquetaSistemaProduccion: string | null;
  };
  visita: { programadaPara: Date };
  /** Nombre de quien firma (el inspector de la visita). */
  inspector: string;
  /** Etiqueta del grupo productivo elegido en la Fase I (RF15). */
  grupoProductivo: string | null;
  galpones: {
    numero: number;
    aves: number | null;
    edadSemanas: number | null;
  }[];
  grupos: GrupoActa[];
  /** Calificación final en % (RF36). */
  final: number | null;
  /** Nivel de bienestar (la clasificación del motor; RF36). */
  clasificacion: string | null;
  indicadores: IndicadorActa[];
  /** Documentos pendientes con su indicador (RF43). */
  pendientes: IndicadorActa[];
  /** Vencimiento del plazo de documentos, si quedaron pendientes (RF43). */
  vencimiento: Date | null;
  /** Imagen PNG de la firma del inspector (RF42). */
  firma: Buffer;
  firmadaEn: Date;
}
