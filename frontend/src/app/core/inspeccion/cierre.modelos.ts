/**
 * Cierre y actas, Fase IV (M7 · RF39–RF45).
 *
 * Espejan lo que devuelve la API (`backend/src/inspeccion/dto/fase4-respuesta.dto.ts`):
 * el resultado del cierre (los documentos pendientes cuentan como 0 %, RF29 y
 * RF43), los indicadores por prioridad de mejora (RF40), el plazo de
 * documentos (RF43) y el acta vigente con su firma (RF41–RF45).
 */

import type { Clasificacion } from '../visitas/visitas.modelos';
import type { CalculoGrupo } from './calculo.modelos';
import type { GrupoMedidas } from './inspeccion.modelos';

/** Prioridad de mejora de un indicador (RF40). */
export type PrioridadMejora = 'ALTA' | 'MEDIA' | 'SIN_PRIORIDAD';

/** Indicador evaluado con su prioridad de mejora (RF39, RF40). */
export interface IndicadorMejora {
  codigo: string;
  nombre: string;
  grupo: GrupoMedidas;
  etiquetaGrupo: string;
  valor: number | null;
  /** El documento quedó pendiente de entrega (RF31). */
  pendiente: boolean;
  prioridad: PrioridadMejora | null;
  etiquetaPrioridad: string | null;
}

/** Acta vigente de la visita (RF41–RF45). */
export interface ActaResumen {
  id: string;
  version: number;
  /** Definitiva: no se modifica ni se reemplaza (RNF10). */
  definitiva: boolean;
  firmadaEn: string;
  firmadaPorNombre: string;
  documentosPendientes: number;
  vencimientoDocumentos: string | null;
  calificacion: number | null;
  clasificacion: Clasificacion | null;
  etiquetaClasificacion: string | null;
  correoEnviadoEn: string | null;
  correoDestinatario: string | null;
  /** Tamaño del PDF en bytes. */
  tamano: number;
  /** Huella SHA-256 del PDF (RNF10). */
  huella: string;
}

/** Aporte de un grupo de medidas en el cierre (RF39). */
export type GrupoCierre = CalculoGrupo;

/** Bloque del cierre de la visita (M7 · RF39–RF45). */
export interface Fase4 {
  /** Todos los indicadores quedaron con valor o «No aplica» (pendientes = 0). */
  completo: boolean;
  /** Indicadores sin evaluar que bloquean la firma. */
  indicadoresSinEvaluar: number;
  /** Indicadores evaluados, por prioridad de mejora (RF40). */
  indicadores: IndicadorMejora[];
  final: number | null;
  clasificacion: Clasificacion | null;
  etiquetaClasificacion: string | null;
  grupos: GrupoCierre[];
  documentosPendientes: number;
  vencimiento: string | null;
  vencido: boolean;
  acta: ActaResumen | null;
  puedeEmitir: boolean;
  motivoNoEmitir: string | null;
}

/** Respuesta del envío del acta por correo (RF45). */
export interface EnvioActa {
  destinatario: string;
  enviadoEn: string;
}

/** Bloque del cierre vacío: la inspección todavía no ha comenzado (M7). */
export function fase4Vacia(): Fase4 {
  return {
    completo: false,
    indicadoresSinEvaluar: 0,
    indicadores: [],
    final: null,
    clasificacion: null,
    etiquetaClasificacion: null,
    grupos: [],
    documentosPendientes: 0,
    vencimiento: null,
    vencido: false,
    acta: null,
    puedeEmitir: false,
    motivoNoEmitir: 'La inspección todavía no ha comenzado.',
  };
}

/** Posición (0–100) del marcador en la barra de la escala del wireframe. */
export function posicionEnEscala(final: number | null): number | null {
  if (final === null) return null;
  return Math.min(100, Math.max(0, final));
}

/** Tono de la insignia del nivel de bienestar (colores del nivel). */
export function tonoClasificacion(
  clasificacion: Clasificacion | null,
): 'excelente' | 'alto' | 'medio' | 'bajo' | 'neutro' {
  switch (clasificacion) {
    case 'EXCELENTE':
      return 'excelente';
    case 'ALTO':
      return 'alto';
    case 'MEDIO':
      return 'medio';
    case 'BAJO':
      return 'bajo';
    default:
      return 'neutro';
  }
}

/**
 * Tono de la insignia del indicador a mejorar (RF40): alta en rojo, media en
 * advertencia, sin prioridad en acento y los pendientes en advertencia, como
 * los pinta la Fase III.
 */
export function tonoPrioridad(
  fila: IndicadorMejora,
): 'peligro' | 'advertencia' | 'acento' | 'neutro' {
  if (fila.pendiente) return 'advertencia';
  switch (fila.prioridad) {
    case 'ALTA':
      return 'peligro';
    case 'MEDIA':
      return 'advertencia';
    case 'SIN_PRIORIDAD':
      return 'acento';
    default:
      return 'neutro';
  }
}
