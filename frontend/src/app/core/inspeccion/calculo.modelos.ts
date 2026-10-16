/**
 * Modelos y reglas del motor de cálculo de la visita (M6 · RF34–RF38).
 *
 * Espejo de `backend/src/inspeccion/calculo.reglas.ts`: el servidor manda,
 * pero sin conexión (RF12) hay que calcular en el equipo para mostrar el
 * resultado en vivo mientras se diligencia la inspección. Si cambia allí,
 * cambia aquí.
 *
 * Las fórmulas son las de la metodología:
 *
 *   1. Indicador = (promedio de puntajes × 100) / escala máxima (RF34).
 *   2. Grupo = promedio de sus indicadores con valor × su peso (RF35).
 *   3. Final = suma de los aportes de los grupos (RF36).
 *   4. Clasificación: Excelente ≥ 90; Alto ≥ 75; Medio ≥ 50; Bajo < 50 (RF36).
 *
 * Los parámetros (indicadores, escalas, pesos y rangos) salen del catálogo
 * (RNF17, RF38); aquí solo viven las fórmulas y las reglas de exclusión:
 * «No aplica» sale del cálculo (RF25) y el puntaje de las mediciones numéricas
 * se convierte con los rangos del catálogo (RF38). El cálculo se hace con
 * precisión completa y se redondea a dos decimales solo al entregarlo (RNF03).
 */

import {
  ETIQUETA_CLASIFICACION,
  type Clasificacion,
} from '../visitas/visitas.modelos';
import {
  claveEvaluacion,
  indicadorCompleto,
  puntajesDe,
  redondear,
  type EvaluacionFase2,
  type ReglasFase2,
} from './fase2.modelos';
import type { DocumentoEvaluado } from './fase3.modelos';
import type {
  GrupoMedidas,
  GrupoProductivo,
  IndicadorCatalogo,
  PesoGrupo,
  RangoEscala,
} from './inspeccion.modelos';

/** Decimales con los que se entrega el resultado (RNF03). */
export const DECIMALES_CALCULO = 2;

/** Etiqueta legible de cada grupo de medidas, como la muestra el wireframe. */
export const ETIQUETA_GRUPO_MEDIDAS: Record<GrupoMedidas, string> = {
  MBA: 'Animal (MBA)',
  MBR: 'Recursos (MBR)',
  MBG: 'Gestión (MBG)',
};

/** Orden de los grupos de medidas, como en el wireframe. */
export const ORDEN_GRUPOS_MEDIDAS: readonly GrupoMedidas[] = [
  'MBA',
  'MBR',
  'MBG',
];

/** Cálculo de un indicador en un galpón (M6 · RF34). */
export interface CalculoGalpon {
  galponNumero: number;
  /** Valor del indicador en % (0–100); nulo sin puntos calificados. */
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
  /** Peso del grupo en el perfil del predio (RF14). */
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

/** Resultado del motor para una visita, como lo entrega la API (M6). */
export interface CalculoVisita {
  /** Todos los indicadores aplicables quedaron con valor o «No aplica». */
  completo: boolean;
  indicadores: CalculoIndicador[];
  grupos: CalculoGrupo[];
  /** Calificación final en % (suma de los aportes); nula sin datos (RF36). */
  final: number | null;
  clasificacion: Clasificacion | null;
  /** Etiqueta legible de la clasificación, como la muestra el wireframe. */
  etiquetaClasificacion: string | null;
}

/** Todo lo que el motor necesita para calcular una visita (M6). */
export interface EntradaCalculo {
  /** Indicadores aplicables al grupo productivo elegido (RF17). */
  indicadores: readonly IndicadorCatalogo[];
  /** Pesos de la visita según el perfil del predio (RF14). */
  pesos: readonly PesoGrupo[];
  /** Números de los galpones marcados para inspeccionar (RF16). */
  galpones: readonly number[];
  evaluaciones: readonly EvaluacionFase2[];
  documentos: readonly DocumentoEvaluado[];
  /** En traspatio no hay fase documental ni MBG (RF33). */
  fase3Aplica: boolean;
  /** Reglas de muestreo de la visita: definen si un galpón terminó (RF18–RF22). */
  reglasFase2: ReglasFase2;
}

/** Cálculo en blanco: cuando la visita todavía no tiene datos que calcular. */
export function calculoVacio(): CalculoVisita {
  return {
    completo: false,
    indicadores: [],
    grupos: [],
    final: null,
    clasificacion: null,
    etiquetaClasificacion: null,
  };
}

/** Clasificación de un puntaje 0–100 (RF36). Espejo del backend. */
export function clasificar(puntaje: number): Clasificacion {
  if (puntaje >= 90) return 'EXCELENTE';
  if (puntaje >= 75) return 'ALTO';
  if (puntaje >= 50) return 'MEDIO';
  return 'BAJO';
}

/**
 * Puntaje de una medición según los rangos del catálogo (RF38): el primer
 * rango cuyo tope (`max`, incluido) alcanza la medición; el rango sin tope
 * recoge el resto. Nulo si los rangos no cubren la medición.
 */
export function puntajePorRangos(
  medicion: number,
  rangos: readonly RangoEscala[],
): number | null {
  for (const rango of rangos) {
    if (rango.max === null || medicion <= rango.max) return rango.puntaje;
  }
  return null;
}

/** Rangos del indicador para el grupo productivo de la visita (RF38). */
export function rangosDe(
  indicador: IndicadorCatalogo,
  grupo: GrupoProductivo | '' | null,
): RangoEscala[] | null {
  if (!grupo) return null;
  const rangos = indicador.escalaRangos?.[grupo];
  return rangos && rangos.length > 0 ? rangos : null;
}

/** Calcula indicadores, grupos, final y clasificación (RF34–RF38). */
export function calcularVisita(entrada: EntradaCalculo): CalculoVisita {
  const porClave = new Map(
    entrada.evaluaciones.map((evaluacion) => [
      claveEvaluacion(evaluacion.galponNumero, evaluacion.indicadorCodigo),
      evaluacion,
    ]),
  );
  const porCodigo = new Map(
    entrada.documentos.map((documento) => [
      documento.indicadorCodigo,
      documento,
    ]),
  );

  const indicadores: CalculoIndicador[] = [];
  for (const indicador of entrada.indicadores) {
    if (indicador.grupo === 'MBG') {
      // En traspatio no hay fase documental ni indicadores de gestión (RF33).
      if (!entrada.fase3Aplica) continue;
      indicadores.push(
        calcularDocumento(indicador, porCodigo.get(indicador.codigo)),
      );
    } else {
      indicadores.push(calcularEnGalpones(indicador, entrada, porClave));
    }
  }

  // Grupo = promedio de sus indicadores con valor × su peso (RF35). Un grupo
  // sin indicadores con valor no tiene promedio ni aporte.
  const grupos: CalculoGrupo[] = ORDEN_GRUPOS_MEDIDAS.map((grupo) => {
    const delGrupo = indicadores.filter(
      (indicador) => indicador.grupo === grupo,
    );
    const conValor = delGrupo.filter((indicador) => indicador.valor !== null);
    const promedio =
      conValor.length === 0
        ? null
        : conValor.reduce(
            (suma, indicador) => suma + (indicador.valor ?? 0),
            0,
          ) / conValor.length;
    const peso = pesoDe(entrada.pesos, grupo);
    return {
      grupo,
      etiqueta: ETIQUETA_GRUPO_MEDIDAS[grupo],
      peso,
      indicadoresConValor: conValor.length,
      indicadoresTotal: delGrupo.length,
      promedio,
      aporte: promedio === null ? null : (promedio * peso) / 100,
    };
  });

  const conAporte = grupos.filter((grupo) => grupo.aporte !== null);
  const final =
    conAporte.length === 0
      ? null
      : conAporte.reduce((suma, grupo) => suma + (grupo.aporte ?? 0), 0);
  const finalRedondeado =
    final === null ? null : redondear(final, DECIMALES_CALCULO);
  // La clasificación se decide sobre el final ya redondeado, para que el nivel
  // que se muestra coincida con el porcentaje que se muestra (RF36).
  const clasificacion =
    finalRedondeado === null ? null : clasificar(finalRedondeado);

  return {
    completo: indicadores.every((indicador) => indicador.completo),
    indicadores,
    grupos: grupos.map((grupo) => ({
      ...grupo,
      promedio:
        grupo.promedio === null
          ? null
          : redondear(grupo.promedio, DECIMALES_CALCULO),
      aporte:
        grupo.aporte === null
          ? null
          : redondear(grupo.aporte, DECIMALES_CALCULO),
    })),
    final: finalRedondeado,
    clasificacion,
    etiquetaClasificacion: clasificacion
      ? ETIQUETA_CLASIFICACION[clasificacion]
      : null,
  };
}

// --------------------------------------------------------------- internos

/** Valor del indicador en un galpón: promedio × 100 / escala máxima (RF34). */
function valorDePuntos(
  puntajes: readonly number[],
  escalaMax: number,
): number | null {
  if (puntajes.length === 0) return null;
  const promedio =
    puntajes.reduce((suma, puntaje) => suma + puntaje, 0) / puntajes.length;
  return (promedio * 100) / escalaMax;
}

/** Indicador de la Fase II: un cálculo por galpón y el promedio de la visita. */
function calcularEnGalpones(
  indicador: IndicadorCatalogo,
  entrada: EntradaCalculo,
  porClave: ReadonlyMap<string, EvaluacionFase2>,
): CalculoIndicador {
  const galpones: CalculoGalpon[] = entrada.galpones.map((galponNumero) => {
    const evaluacion = porClave.get(
      claveEvaluacion(galponNumero, indicador.codigo),
    );
    const noAplica = evaluacion?.noAplica ?? false;
    return {
      galponNumero,
      valor:
        evaluacion && !noAplica
          ? valorDePuntos(puntajesDe(evaluacion.puntos), indicador.escalaMax)
          : null,
      noAplica,
      completo:
        evaluacion !== undefined &&
        indicadorCompleto(evaluacion, indicador, entrada.reglasFase2),
    };
  });

  const conValor = galpones.filter((galpon) => galpon.valor !== null);
  const valor =
    conValor.length === 0
      ? null
      : conValor.reduce((suma, galpon) => suma + (galpon.valor ?? 0), 0) /
        conValor.length;

  return {
    codigo: indicador.codigo,
    grupo: indicador.grupo,
    valor,
    // «No aplica» de todos los galpones evaluados excluye el indicador (RF25).
    noAplica:
      galpones.length > 0 && galpones.every((galpon) => galpon.noAplica),
    // Sin galpones marcados no hay evaluación: el indicador no está completo.
    completo:
      galpones.length > 0 && galpones.every((galpon) => galpon.completo),
    galpones,
  };
}

/** Indicador de la Fase III: el valor sale del puntaje del documento (RF34). */
function calcularDocumento(
  indicador: IndicadorCatalogo,
  documento: DocumentoEvaluado | undefined,
): CalculoIndicador {
  const puntaje = documento?.puntaje ?? null;
  return {
    codigo: indicador.codigo,
    grupo: indicador.grupo,
    valor: puntaje === null ? null : (puntaje * 100) / indicador.escalaMax,
    noAplica: false,
    // Un documento pendiente todavía no tiene puntaje: falta para el cálculo.
    completo: puntaje !== null,
    galpones: [],
  };
}

/** Peso del grupo en el perfil del predio (RF14); 0 si el perfil no lo pesa. */
function pesoDe(pesos: readonly PesoGrupo[], grupo: GrupoMedidas): number {
  return pesos.find((peso) => peso.grupo === grupo)?.peso ?? 0;
}
