import type { Indicador } from '../metodologia/entities/indicador.entity.js';
import type { PesoGrupo } from '../metodologia/entities/peso-grupo.entity.js';
import {
  ETIQUETA_GRUPO_MEDIDAS,
  GrupoMedidas,
  ORDEN_GRUPOS_MEDIDAS,
  type GrupoProductivo,
  type RangoEscala,
} from '../metodologia/metodologia.tipos.js';
import { clasificar } from '../visitas/calificacion.js';
import type { TipoPredio } from '../visitas/visitas.tipos.js';
import { indicadorCompleto, puntajesDe, redondear } from './fase2.reglas.js';
import { claveEvaluacion, type EvaluacionFase2 } from './fase2.tipos.js';
import type { DocumentoEvaluado } from './fase3.tipos.js';
import type {
  CalculoGalpon,
  CalculoIndicador,
  CalculoVisita,
  EntradaCalculo,
  ResultadoInspeccion,
} from './calculo.tipos.js';

/**
 * Motor de cálculo (M6 · RF34–RF38), aislado y probable.
 *
 * Las fórmulas son las de la metodología (los documentos las marcan «PDF»):
 *
 *   1. Indicador = (promedio de puntajes × 100) / escala máxima (RF34).
 *   2. Grupo = promedio de sus indicadores con valor × su peso (RF35).
 *   3. Final = suma de los aportes de los grupos (RF36).
 *   4. Clasificación: Excelente ≥ 90; Alto ≥ 75; Medio ≥ 50; Bajo < 50 (RF36).
 *
 * Los parámetros (indicadores, escalas, pesos y rangos) salen del catálogo
 * (RNF17, RF38); aquí solo viven las fórmulas y las reglas de exclusión:
 * «No aplica» sale del cálculo (RF25) y el puntaje de las mediciones numéricas
 * se convierte con los rangos del catálogo (RF38).
 *
 * El cálculo se hace con precisión completa y se redondea a dos decimales solo
 * al entregarlo (RNF03): así la suma de los grupos coincide con las fórmulas.
 * El espejo del frontend (`calculo.modelos.ts`) reproduce estas mismas reglas
 * para el cálculo en vivo sin conexión; si cambia aquí, cambia allí.
 */

/** Decimales con los que se entrega el resultado (RNF03). */
export const DECIMALES_CALCULO = 2;

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
  indicador: Indicador,
  grupo: GrupoProductivo | null,
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
    if (indicador.grupo === GrupoMedidas.MBG) {
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
  // sin indicadores con valor no tiene promedio; la metodología no define qué
  // hacer si «No aplica» deja un grupo entero vacío (punto abierto informado).
  const grupos = ORDEN_GRUPOS_MEDIDAS.map((grupo) => {
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
    const peso = pesoDe(entrada.pesos, entrada.tipoPredio, grupo);
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
    // La clasificación se decide sobre el final ya redondeado, para que el
    // nivel que se muestra coincida con el porcentaje que se muestra (RF36).
    clasificacion:
      finalRedondeado === null ? null : clasificar(finalRedondeado),
  };
}

/** El resumen que la inspección guarda de la última pasada del motor (M6). */
export function resultadoPara(
  calculo: CalculoVisita,
  ahora: Date,
): ResultadoInspeccion {
  return {
    completo: calculo.completo,
    grupos: calculo.grupos.map((grupo) => ({
      grupo: grupo.grupo,
      etiqueta: grupo.etiqueta,
      peso: grupo.peso,
      promedio: grupo.promedio,
      aporte: grupo.aporte,
    })),
    final: calculo.final,
    clasificacion: calculo.clasificacion,
    calculadoEn: ahora.toISOString(),
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
  indicador: Indicador,
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
  indicador: Indicador,
  documento: DocumentoEvaluado | undefined,
): CalculoIndicador {
  const puntaje = documento?.puntaje ?? null;
  return {
    codigo: indicador.codigo,
    grupo: indicador.grupo,
    valor: puntaje === null ? null : (puntaje * 100) / indicador.escalaMax,
    noAplica: false,
    // Un documento pendiente todavía no tiene puntaje: falta para el cálculo
    // (el cierre lo recalcula dentro del plazo, RF43/RF44).
    completo: puntaje !== null,
    galpones: [],
  };
}

/** Peso del grupo en el perfil del predio (RF14); 0 si el perfil no lo pesa. */
function pesoDe(
  pesos: readonly PesoGrupo[],
  perfil: TipoPredio,
  grupo: GrupoMedidas,
): number {
  const fila = pesos.find(
    (peso) => peso.perfil === perfil && peso.grupo === grupo,
  );
  return fila ? Number(fila.peso) : 0;
}
