import type { Indicador } from '../metodologia/entities/indicador.entity.js';
import type { PesoGrupo } from '../metodologia/entities/peso-grupo.entity.js';
import type {
  GrupoMedidas,
  GrupoProductivo,
} from '../metodologia/metodologia.tipos.js';
import type { Clasificacion, TipoPredio } from '../visitas/visitas.tipos.js';
import type { ReglasFase2 } from './fase2.reglas.js';
import type { EvaluacionFase2 } from './fase2.tipos.js';
import type { DocumentoEvaluado } from './fase3.tipos.js';

/**
 * Forma del cálculo de la visita (M6 · RF34–RF38).
 *
 * El motor (`calculo.reglas.ts`) produce estas estructuras; la respuesta de la
 * API las entrega a la interfaz y la inspección guarda un resumen en
 * `inspeccion.resultado` (JSONB) para el panel (RF10). El frontend las espeja
 * en `core/inspeccion/calculo.modelos.ts` para calcular en vivo sin conexión.
 */

/** Cálculo de un indicador en un galpón (M6 · RF34). */
export interface CalculoGalpon {
  galponNumero: number;
  /** Valor del indicador en % (0–100); nulo sin puntos calificados (RF34). */
  valor: number | null;
  /** El galpón marcó el indicador «No aplica» (RF25). */
  noAplica: boolean;
  /** El galpón terminó su evaluación (o la excluyó con motivo). */
  completo: boolean;
}

/** Cálculo de un indicador de la visita (M6 · RF34). */
export interface CalculoIndicador {
  codigo: string;
  grupo: GrupoMedidas;
  /**
   * Valor del indicador en % (0–100): promedio de los galpones con valor; nulo
   * sin ninguno. En los indicadores de gestión (MBG) sale del puntaje del
   * documento.
   */
  valor: number | null;
  /** Todos los galpones lo excluyeron con «No aplica» (RF25). */
  noAplica: boolean;
  /** Quedó terminado en todos los galpones (o excluido con motivo). */
  completo: boolean;
  /** Detalle por galpón; vacío en los indicadores de gestión (MBG). */
  galpones: CalculoGalpon[];
}

/** Cálculo de un grupo de medidas (M6 · RF35). */
export interface CalculoGrupo {
  grupo: GrupoMedidas;
  etiqueta: string;
  /** Peso del grupo en el perfil del predio (RF14, RF48). */
  peso: number;
  /** Indicadores del grupo que ya tienen valor. */
  indicadoresConValor: number;
  /** Indicadores del grupo que aplican al grupo productivo (RF17). */
  indicadoresTotal: number;
  /** Promedio de los indicadores con valor, en %; nulo si no hay ninguno. */
  promedio: number | null;
  /** Aporte al resultado: promedio × peso; nulo si no hay promedio (RF35). */
  aporte: number | null;
}

/** Resultado completo del motor para una visita (M6 · RF34–RF36). */
export interface CalculoVisita {
  /** Todos los indicadores aplicables quedaron con valor o «No aplica». */
  completo: boolean;
  indicadores: CalculoIndicador[];
  grupos: CalculoGrupo[];
  /** Calificación final en % (suma de los aportes); nula sin datos (RF36). */
  final: number | null;
  clasificacion: Clasificacion | null;
}

/**
 * Resumen del resultado que se guarda en `inspeccion.resultado` (M6): los
 * grupos y la calificación de la última pasada del motor. El panel (RF10) saca
 * de aquí el promedio por grupo de medidas.
 */
export interface ResultadoInspeccion {
  completo: boolean;
  grupos: {
    grupo: GrupoMedidas;
    etiqueta: string;
    peso: number;
    promedio: number | null;
    aporte: number | null;
  }[];
  final: number | null;
  clasificacion: Clasificacion | null;
  calculadoEn: string;
}

/** Todo lo que el motor necesita para calcular una visita (M6). */
export interface EntradaCalculo {
  /** Indicadores aplicables al grupo productivo elegido (RF17). */
  indicadores: readonly Indicador[];
  grupoProductivo: GrupoProductivo | null;
  /** Perfil del predio: de él salen los pesos aplicables (RF14). */
  tipoPredio: TipoPredio;
  /** Pesos de la metodología de la visita (RF48). */
  pesos: readonly PesoGrupo[];
  /** Números de los galpones marcados para inspeccionar (RF16). */
  galpones: readonly number[];
  evaluaciones: readonly EvaluacionFase2[];
  documentos: readonly DocumentoEvaluado[];
  /** En traspatio no hay fase documental ni MBG (RF33). */
  fase3Aplica: boolean;
  /** Reglas de muestreo de la visita: definen si un galpón terminó (RF18–RF22). */
  reglasFase2: ReglasFase2;
  /**
   * El cierre (M7 · RF43/RF44) cuenta los documentos pendientes como puntaje
   * 0 (lo que RF29 haría si nunca llegaran): así el cierre puede firmar una
   * acta provisional con calificación, que se recalcula si los documentos
   * llegan dentro del plazo.
   */
  pendientesCuentanCero?: boolean;
}
