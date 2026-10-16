import type { Indicador } from '../metodologia/entities/indicador.entity.js';
import {
  GrupoProductivo,
  TipoEvaluacion,
} from '../metodologia/metodologia.tipos.js';
import { TipoPredio } from '../visitas/visitas.tipos.js';
import { puntajePorRangos, rangosDe } from './calculo.reglas.js';
import { redondear } from './fase2.reglas.js';
import type { DocumentoEvaluado } from './fase3.tipos.js';

/**
 * Reglas de la Fase III (M5 · RF27–RF33), aisladas y probables.
 *
 * Lo numérico de esta fase viene de la metodología: la mortalidad se califica
 * por rangos (RF30) y el resto de documentos con la escala 0/1/2 (RF19), con
 * dos reglas automáticas: sin documento el puntaje es 0 (RF29) y el documento
 * no presentado puede marcarse pendiente para entregarlo dentro del plazo de
 * cierre (RF31). En traspatio la fase no existe (RF33).
 *
 * Los rangos de la mortalidad ya no viven aquí: son datos del catálogo
 * (`indicador.escalaRangos`, RF38/RNF17) y los aplica el motor de cálculo (M6).
 */

/** Decimales admitidos en la tasa de mortalidad. */
export const MORTALIDAD_DECIMALES = 2;

/** Escala de calificación de los documentos (RF19). */
export const PUNTAJE_MIN = 0;
export const PUNTAJE_MAX = 2;

/** Reglas de la fase documental para esta visita (RF30, RF33). */
export interface ReglasFase3 {
  /** La fase documental aplica: solo en corral (RF33). */
  aplica: boolean;
  /** Grupo productivo elegido en la Fase I; de él salen los rangos (RF30). */
  grupoProductivo: GrupoProductivo | null;
}

/** Avance de la fase documental (RF24, RF27). */
export interface AvanceFase3 {
  /** Documentos verificados: calificados o marcados pendientes (RF31). */
  verificados: number;
  /** Documentos que pide la fase. */
  total: number;
}

/**
 * Reglas de la fase documental (RF33): en traspatio no aplica. Los rangos de
 * la mortalidad salen del catálogo de la visita (RF38).
 */
export function reglasFase3(
  tipoPredio: TipoPredio,
  grupoProductivo: GrupoProductivo | null,
): ReglasFase3 {
  return {
    aplica: tipoPredio === TipoPredio.CORRAL,
    grupoProductivo: grupoProductivo ?? null,
  };
}

/**
 * ¿El documento ya quedó verificado? (RF27–RF31). Cuenta como verificado el
 * calificado y el marcado pendiente: los pendientes se entregan dentro del
 * plazo de cierre y allí se recalcula su puntaje (RF43, RF44).
 */
export function documentoVerificado(
  documento: DocumentoEvaluado | undefined,
): boolean {
  if (!documento) return false;
  return documento.puntaje !== null || documento.pendiente;
}

/** Avance de la fase documental: verificados sobre el total (RF24). */
export function avanceFase3(
  documentos: readonly DocumentoEvaluado[],
  indicadores: readonly Indicador[],
): AvanceFase3 {
  const porCodigo = new Map(
    documentos.map((documento) => [documento.indicadorCodigo, documento]),
  );
  const verificados = indicadores.filter((indicador) =>
    documentoVerificado(porCodigo.get(indicador.codigo)),
  ).length;
  return { verificados, total: indicadores.length };
}

/**
 * Revisa un documento antes de guardarlo (RF28–RF30) y devuelve los problemas
 * encontrados, con mensajes para mostrar tal cual. Un arreglo vacío significa
 * que se puede guardar.
 *
 * Guardar un borrador no exige que el documento esté verificado (RF26): se
 * acepta a medio llenar. Lo que no se acepta es un dato imposible: un puntaje
 * que contradiga la regla del 0 (RF29), una tasa de mortalidad fuera de
 * 0–100 % o un puntaje que no salga de los rangos del catálogo (RF30, RF38).
 */
export function erroresDeDocumento(
  documento: DocumentoEvaluado,
  indicador: Indicador,
  grupoProductivo: GrupoProductivo | null,
): string[] {
  const errores: string[] = [];
  const nombre = indicador.nombre;

  if (
    documento.presentado === null &&
    (documento.puntaje !== null || documento.mortalidad !== null)
  ) {
    errores.push(`«${nombre}»: indique primero si el documento se presentó.`);
  }

  // Sin documento, el puntaje es 0 (RF29).
  if (
    documento.presentado === false &&
    documento.puntaje !== null &&
    documento.puntaje !== 0
  ) {
    errores.push(
      `«${nombre}»: si el documento no se presenta, el puntaje es 0 (RF29).`,
    );
  }

  if (indicador.tipoEvaluacion === TipoEvaluacion.MORTALIDAD) {
    const tasa = documento.mortalidad;
    if (tasa !== null) {
      if (!Number.isFinite(tasa) || tasa < 0 || tasa > 100) {
        errores.push(
          `«${nombre}»: la tasa de mortalidad debe estar entre 0 % y 100 %.`,
        );
      } else if (
        Math.abs(redondear(tasa, MORTALIDAD_DECIMALES) - tasa) > 1e-9
      ) {
        errores.push(
          `«${nombre}»: use máximo ${MORTALIDAD_DECIMALES} decimales en la tasa de mortalidad.`,
        );
      } else if (documento.presentado === true && grupoProductivo) {
        // El puntaje sale de los rangos del catálogo (RF30, RF38): no se digita.
        const rangos = rangosDe(indicador, grupoProductivo);
        if (!rangos) {
          errores.push(
            `«${nombre}»: el catálogo no tiene los rangos de este indicador.`,
          );
        } else {
          const esperado = puntajePorRangos(tasa, rangos);
          if (documento.puntaje !== null && documento.puntaje !== esperado) {
            errores.push(
              `«${nombre}»: el puntaje de la mortalidad sale de los rangos de la metodología (RF30).`,
            );
          }
        }
      }
    }
  } else if (
    documento.puntaje !== null &&
    (!Number.isInteger(documento.puntaje) ||
      documento.puntaje < PUNTAJE_MIN ||
      documento.puntaje > PUNTAJE_MAX)
  ) {
    errores.push(`«${nombre}»: el puntaje debe ser 0, 1 o 2.`);
  }

  return errores;
}
