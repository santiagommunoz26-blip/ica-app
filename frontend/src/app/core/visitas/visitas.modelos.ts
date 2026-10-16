/**
 * Modelos de la gestión de visitas (M2 · RF08–RF12).
 * Reflejan lo que devuelve la API (`backend/src/visitas/dto`).
 *
 * Las etiquetas legibles viven aquí para que la interfaz no las escriba a mano
 * en cada pantalla (una sola fuente, RNF15).
 */

import type { PeticionGuardarInspeccion } from '../inspeccion/inspeccion.modelos';

/** Estados de una visita (RF09). */
export type EstadoVisita =
  'PROGRAMADA' | 'EN_CURSO' | 'PENDIENTE_DOCUMENTOS' | 'CERRADA';

/** Tipo de predio: granja (corral) o traspatio (RF14). */
export type TipoPredio = 'CORRAL' | 'TRASPATIO';

/** Nivel de bienestar (RF21, RF36). Lo calcula el motor de cálculo (M6). */
export type Clasificacion = 'EXCELENTE' | 'ALTO' | 'MEDIO' | 'BAJO';

/** Orden del ciclo de la visita. */
export const ESTADOS_VISITA: readonly EstadoVisita[] = [
  'PROGRAMADA',
  'EN_CURSO',
  'PENDIENTE_DOCUMENTOS',
  'CERRADA',
];

/** Etiqueta legible de cada estado. */
export const ETIQUETA_ESTADO: Record<EstadoVisita, string> = {
  PROGRAMADA: 'Programada',
  EN_CURSO: 'En curso',
  PENDIENTE_DOCUMENTOS: 'Pendiente de documentos',
  CERRADA: 'Cerrada',
};

/** Etiqueta legible de cada tipo de predio. */
export const ETIQUETA_TIPO_PREDIO: Record<TipoPredio, string> = {
  CORRAL: 'Granja (corral)',
  TRASPATIO: 'Traspatio',
};

/** Etiqueta legible de cada clasificación. */
export const ETIQUETA_CLASIFICACION: Record<Clasificacion, string> = {
  EXCELENTE: 'Excelente',
  ALTO: 'Alto',
  MEDIO: 'Medio',
  BAJO: 'Bajo',
};

/** Tono de la insignia que corresponde a cada estado (colores de los tokens). */
export const TONO_ESTADO: Record<
  EstadoVisita,
  'marca' | 'exito' | 'advertencia' | 'neutro'
> = {
  PROGRAMADA: 'marca',
  EN_CURSO: 'advertencia',
  PENDIENTE_DOCUMENTOS: 'neutro',
  CERRADA: 'exito',
};

/** Tono de la insignia que corresponde a cada clasificación. */
export const TONO_CLASIFICACION: Record<Clasificacion, Clasificacion> = {
  EXCELENTE: 'EXCELENTE',
  ALTO: 'ALTO',
  MEDIO: 'MEDIO',
  BAJO: 'BAJO',
};

/**
 * Transiciones permitidas entre estados (RF09).
 *
 * Es un espejo de las reglas del backend (`visitas.tipos.ts`): el servidor es
 * quien manda, pero sin conexión hace falta poder anticipar en qué estados se
 * puede poner una visita. Si cambian allí, cambian aquí.
 */
export const TRANSICIONES_ESTADO: Record<
  EstadoVisita,
  readonly EstadoVisita[]
> = {
  PROGRAMADA: ['EN_CURSO'],
  EN_CURSO: ['PENDIENTE_DOCUMENTOS', 'CERRADA'],
  PENDIENTE_DOCUMENTOS: ['EN_CURSO', 'CERRADA'],
  CERRADA: [],
};

/** Predio al que se asocia una visita (RF08). */
export interface Predio {
  id: string;
  nombre: string;
  municipio: string;
  vereda: string;
  tipoPredio: TipoPredio;
  etiquetaTipoPredio: string;
}

/** Datos mínimos para registrar un predio desde el formulario de visita. */
export interface DatosPredio {
  nombre: string;
  municipio: string;
  vereda: string;
  tipoPredio: TipoPredio;
}

/** Inspector asignado a la visita. */
export interface InspectorVisita {
  id: string;
  nombreCompleto: string;
}

/** Visita tal como la devuelve la API. */
export interface Visita {
  id: string;
  predio: Predio;
  inspector: InspectorVisita;
  programadaPara: string;
  estado: EstadoVisita;
  etiquetaEstado: string;
  observaciones: string | null;
  calificacion: number | null;
  clasificacion: Clasificacion | null;
  etiquetaClasificacion: string | null;
  editable: boolean;
  accionesPosibles: EstadoVisita[];
  createdAt: string;
  updatedAt: string;
  /**
   * Marca solo local: la visita tiene cambios guardados en el equipo que
   * todavía no llegaron al servidor (RF12).
   */
  pendiente?: boolean;
}

/** Conteos por estado, para las pestañas del listado (RF11). */
export interface ConteosVisitas {
  todas: number;
  programadas: number;
  enCurso: number;
  pendientesDocumentos: number;
  cerradas: number;
}

/** Página de visitas. */
export interface ListaVisitas {
  datos: Visita[];
  total: number;
  pagina: number;
  porPagina: number;
  conteos: ConteosVisitas;
}

/** Filtros de la lista de visitas (RF11). */
export interface FiltrosVisitas {
  pagina?: number;
  porPagina?: number;
  busqueda?: string;
  municipio?: string;
  estado?: EstadoVisita;
  tipoPredio?: TipoPredio;
  desde?: string;
  hasta?: string;
  inspectorId?: string;
}

/** Punto de la evolución de la calificación (RF10). */
export interface PuntoEvolucion {
  mes: string;
  etiqueta: string;
  calificacion: number | null;
  visitas: number;
}

/** Cuántas visitas hay en cada nivel (RF10). */
export interface ConteoClasificacion {
  clasificacion: Clasificacion;
  etiqueta: string;
  cantidad: number;
  porcentaje: number;
}

/** Promedio por grupo de medidas (RF10). Llega vacío hasta M6. */
export interface PromedioGrupo {
  grupo: string;
  etiqueta: string;
  promedio: number | null;
  peso: number | null;
}

/** Indicadores del panel principal (RF10). */
export interface ResumenPanel {
  visitasDelMes: number;
  variacionVisitas: number | null;
  calificacionPromedio: number | null;
  clasificacionPromedio: Clasificacion | null;
  etiquetaClasificacionPromedio: string | null;
  documentosPendientes: number;
  totalVisitas: number;
  predios: number;
  evolucion: PuntoEvolucion[];
  distribucion: ConteoClasificacion[];
  promedioPorGrupo: PromedioGrupo[];
  proximas: Visita[];
}

/** Datos para programar una visita (RF08). */
export interface PeticionCrearVisita {
  /** Identificador que propone el equipo (programación sin conexión, RF12). */
  id?: string;
  predioId?: string;
  predio?: DatosPredio;
  inspectorId?: string;
  programadaPara: string;
  observaciones?: string;
}

/** Cambios permitidos en una visita programada. */
export interface PeticionActualizarVisita {
  predioId?: string;
  inspectorId?: string;
  programadaPara?: string;
  observaciones?: string;
}

/** Tipo de operación guardada sin conexión (RF12). */
export type TipoOperacionSincronizacion =
  | 'CREAR_VISITA'
  | 'ACTUALIZAR_VISITA'
  | 'CAMBIAR_ESTADO'
  | 'GUARDAR_INSPECCION';

/** Operación hecha sin conexión, pendiente de enviar (RF12). */
export interface OperacionSincronizacion {
  /** Identificador de la operación en el equipo. */
  id: string;
  tipo: TipoOperacionSincronizacion;
  visitaId?: string;
  crear?: PeticionCrearVisita;
  actualizar?: PeticionActualizarVisita;
  estado?: { estado: EstadoVisita };
  /** Ficha de la Fase I guardada sin conexión (M3 · RF13–RF16). */
  inspeccion?: PeticionGuardarInspeccion;
  /** Cuándo se hizo la operación en el equipo. */
  registradoEn: string;
  /** Resumen legible, para mostrarlo en la pantalla de pendientes. */
  resumen: string;
}

/** Resultado de una operación sincronizada. */
export interface ResultadoSincronizacion {
  id: string;
  estado: 'APLICADA' | 'RECHAZADA';
  motivo?: string;
}

/** Respuesta del servidor al sincronizar (RF12). */
export interface RespuestaSincronizacion {
  resultados: ResultadoSincronizacion[];
  visitas: Visita[];
}

/** Pestañas del listado, como en el wireframe. */
export const PESTANAS_VISITAS: readonly {
  clave: 'todas' | EstadoVisita;
  etiqueta: string;
}[] = [
  { clave: 'todas', etiqueta: 'Todas' },
  { clave: 'EN_CURSO', etiqueta: 'En curso' },
  { clave: 'PENDIENTE_DOCUMENTOS', etiqueta: 'Pendientes de docs' },
  { clave: 'CERRADA', etiqueta: 'Cerradas' },
];
