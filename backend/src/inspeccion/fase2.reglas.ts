import type { Indicador } from '../metodologia/entities/indicador.entity.js';
import {
  ETIQUETA_GRUPO_MEDIDAS,
  GrupoMedidas,
  GrupoProductivo,
  TipoMuestreo,
} from '../metodologia/metodologia.tipos.js';
import { TipoPredio } from '../visitas/visitas.tipos.js';
import {
  claveEvaluacion,
  type EvaluacionFase2,
  type PuntoEvaluado,
} from './fase2.tipos.js';

/**
 * Reglas de la Fase II (M4 · RF18–RF26), aisladas y probables.
 *
 * Todo lo numérico de esta fase viene de la metodología (los documentos lo
 * marcan «PDF»): 9 puntos de muestreo por galpón (RF18), escala 0/1/2 (RF19),
 * 15–30 aves por punto en piso y 3–5 jaulas con 10–20 aves en jaula (RF20),
 * conteo previo en jaula (RF21) y hojas centinela con mínimo 3 en corral y 1
 * en traspatio (RF22). El valor del indicador es el del motor de cálculo
 * (RF34): promedio de los puntajes × 100 / 2; aquí se adelanta lo mínimo para
 * el cálculo en vivo de esta fase (el motor completo es M6).
 */

/** Puntos de muestreo por galpón (RF18). */
export const PUNTOS_MUESTREO = 9;

/** Hojas centinela: mínimo según el tipo de predio (RF22). */
export const HOJAS_CENTINELA_MINIMO: Record<TipoPredio, number> = {
  [TipoPredio.CORRAL]: 3,
  [TipoPredio.TRASPATIO]: 1,
};

/** Muestra en piso: aves por punto (RF20). */
export const MUESTRA_PISO = { avesMin: 15, avesMax: 30 } as const;

/** Muestra en jaula: jaulas y total de aves por punto (RF20). */
export const MUESTRA_JAULA = {
  jaulasMin: 3,
  jaulasMax: 5,
  avesMin: 10,
  avesMax: 20,
} as const;

/** Escala de calificación (RF19). */
export const PUNTAJE_MIN = 0;
export const PUNTAJE_MAX = 2;

/** Tope de puntos de un indicador: acota las hojas centinela (RF22). */
export const MAXIMO_PUNTOS = 30;

/** Reglas de muestreo que la Fase II muestra y valida (RF18–RF22). */
export interface ReglasFase2 {
  /** Puntos de muestreo por indicador (RF18). */
  puntos: number;
  /** Mínimo de hojas centinela según el tipo de predio (RF22). */
  hojasCentinelaMinimo: number;
  /** Verdadero si el grupo productivo se evalúa en jaula (RF20). */
  jaula: boolean;
  /** Aves que se evalúan por punto. */
  avesMin: number;
  avesMax: number;
  /** Jaulas por punto; nulas en piso. */
  jaulasMin: number | null;
  jaulasMax: number | null;
}

/** Avance de un grupo de medidas en un galpón (RF24). */
export interface AvanceGrupo {
  grupo: GrupoMedidas;
  etiqueta: string;
  /** Indicadores completos del grupo. */
  completos: number;
  /** Indicadores del grupo que aplican al grupo productivo (RF17). */
  total: number;
}

/** Avance de un galpón, por grupo de medidas (RF24). */
export interface AvanceGalpon {
  galponNumero: number;
  grupos: AvanceGrupo[];
}

/**
 * Reglas de muestreo de la visita (RF18–RF22).
 *
 * El sistema de jaula lo decide el grupo productivo (ponedora en jaula): es el
 * dato que el inspector elige en la Fase I y del que dependen los indicadores
 * aplicables (RF15, RF17).
 */
export function reglasFase2(
  tipoPredio: TipoPredio,
  grupoProductivo: GrupoProductivo | null,
): ReglasFase2 {
  const jaula = grupoProductivo === GrupoProductivo.PONEDORA_JAULA;
  return {
    puntos: PUNTOS_MUESTREO,
    hojasCentinelaMinimo: HOJAS_CENTINELA_MINIMO[tipoPredio],
    jaula,
    avesMin: jaula ? MUESTRA_JAULA.avesMin : MUESTRA_PISO.avesMin,
    avesMax: jaula ? MUESTRA_JAULA.avesMax : MUESTRA_PISO.avesMax,
    jaulasMin: jaula ? MUESTRA_JAULA.jaulasMin : null,
    jaulasMax: jaula ? MUESTRA_JAULA.jaulasMax : null,
  };
}

/** Cuántos puntos pide un indicador: fijos (RF18) o un mínimo (RF22). */
export function puntosRequeridos(
  indicador: Indicador,
  reglas: ReglasFase2,
): { fijos: boolean; minimo: number } {
  return indicador.tipoMuestreo === TipoMuestreo.HOJAS_CENTINELA
    ? { fijos: false, minimo: reglas.hojasCentinelaMinimo }
    : { fijos: true, minimo: reglas.puntos };
}

/** Promedio de los puntajes registrados; nulo si todavía no hay ninguno. */
export function promedioPuntos(
  puntos: readonly PuntoEvaluado[],
): number | null {
  const puntajes = puntajesDe(puntos);
  if (puntajes.length === 0) return null;
  const suma = puntajes.reduce((total, puntaje) => total + puntaje, 0);
  return suma / puntajes.length;
}

/** Valor del indicador en porcentaje (RF34): promedio × 100 / 2. */
export function valorIndicador(promedio: number | null): number | null {
  if (promedio === null) return null;
  return redondear((promedio * 100) / 2, 2);
}

/** Puntos con puntaje registrado. */
export function puntajesDe(puntos: readonly PuntoEvaluado[]): number[] {
  return puntos
    .map((punto) => punto.puntaje)
    .filter((puntaje): puntaje is number => puntaje !== null);
}

/** ¿La muestra del punto está dentro de lo que pide la metodología? (RF20) */
export function muestraValida(
  punto: PuntoEvaluado,
  reglas: ReglasFase2,
): boolean {
  const avesBien = enRango(punto.aves, reglas.avesMin, reglas.avesMax);
  if (!reglas.jaula) return avesBien;
  return avesBien && enRango(punto.jaulas, reglas.jaulasMin, reglas.jaulasMax);
}

/**
 * Un punto está completo cuando tiene puntaje y la muestra pedida (RF19–RF21):
 * en piso, las aves evaluadas; en jaula, las jaulas y el total de aves.
 */
export function puntoCompleto(
  punto: PuntoEvaluado,
  reglas: ReglasFase2,
): boolean {
  return punto.puntaje !== null && muestraValida(punto, reglas);
}

/**
 * Un indicador está completo cuando lo están todos sus puntos o cuando está
 * marcado «No aplica» con motivo (RF25).
 */
export function indicadorCompleto(
  evaluacion: EvaluacionFase2 | undefined,
  indicador: Indicador,
  reglas: ReglasFase2,
): boolean {
  if (!evaluacion) return false;
  if (evaluacion.noAplica) {
    return (evaluacion.motivoNoAplica ?? '').trim().length > 0;
  }

  const requeridos = puntosRequeridos(indicador, reglas);
  if (requeridos.fijos) {
    if (evaluacion.puntos.length !== reglas.puntos) return false;
    const numeros = new Set(evaluacion.puntos.map((punto) => punto.numero));
    for (let numero = 1; numero <= reglas.puntos; numero += 1) {
      if (!numeros.has(numero)) return false;
    }
  } else if (evaluacion.puntos.length < requeridos.minimo) {
    return false;
  }

  return evaluacion.puntos.every((punto) => puntoCompleto(punto, reglas));
}

/**
 * Avance por galpón y grupo de medidas (RF24), para la lista de indicadores y
 * el panel «Avance galpón» del wireframe («MBR 3/9 · MBA 0/10»).
 *
 * Solo cuenta los indicadores que recibe (el servicio pasa los aplicables al
 * grupo productivo y de los grupos de la Fase II: MBA y MBR).
 */
export function avanceDe(
  galpones: readonly number[],
  indicadores: readonly Indicador[],
  evaluaciones: readonly EvaluacionFase2[],
  reglas: ReglasFase2,
): AvanceGalpon[] {
  const porClave = new Map<string, EvaluacionFase2>();
  for (const evaluacion of evaluaciones) {
    porClave.set(
      claveEvaluacion(evaluacion.galponNumero, evaluacion.indicadorCodigo),
      evaluacion,
    );
  }

  return galpones.map((galponNumero) => ({
    galponNumero,
    grupos: [GrupoMedidas.MBA, GrupoMedidas.MBR].map((grupo) => {
      const delGrupo = indicadores.filter(
        (indicador) => indicador.grupo === grupo,
      );
      const completos = delGrupo.filter((indicador) =>
        indicadorCompleto(
          porClave.get(claveEvaluacion(galponNumero, indicador.codigo)),
          indicador,
          reglas,
        ),
      ).length;
      return {
        grupo,
        etiqueta: ETIQUETA_GRUPO_MEDIDAS[grupo],
        completos,
        total: delGrupo.length,
      };
    }),
  }));
}

/**
 * Revisa una evaluación antes de guardarla (RF19–RF21) y devuelve los
 * problemas encontrados, con mensajes para mostrar tal cual. Un arreglo vacío
 * significa que se puede guardar.
 *
 * Guardar un borrador **no** exige que el indicador esté completo (RF26): los
 * puntos a medio llenar se aceptan. Lo que no se acepta es un dato imposible:
 * puntajes fuera de 0–2, muestras fuera de los rangos o jaulas calificadas sin
 * contar primero las aves (RF21).
 */
export function erroresDeEvaluacion(
  evaluacion: EvaluacionFase2,
  indicador: Indicador,
  reglas: ReglasFase2,
): string[] {
  if (evaluacion.noAplica) {
    if ((evaluacion.motivoNoAplica ?? '').trim().length < 3) {
      return [
        `«${indicador.nombre}»: escriba el motivo por el que no aplica (mínimo 3 caracteres).`,
      ];
    }
    return [];
  }

  const errores: string[] = [];
  const nombre = indicador.nombre;
  const maximo =
    indicador.tipoMuestreo === TipoMuestreo.HOJAS_CENTINELA
      ? MAXIMO_PUNTOS
      : reglas.puntos;
  const numeros = new Set<number>();

  for (const punto of evaluacion.puntos) {
    if (
      !Number.isInteger(punto.numero) ||
      punto.numero < 1 ||
      punto.numero > maximo
    ) {
      errores.push(`«${nombre}»: el punto ${punto.numero} no es válido.`);
      continue;
    }
    if (numeros.has(punto.numero)) {
      errores.push(`«${nombre}»: el punto ${punto.numero} está repetido.`);
    }
    numeros.add(punto.numero);

    if (
      punto.puntaje !== null &&
      (!Number.isInteger(punto.puntaje) ||
        punto.puntaje < PUNTAJE_MIN ||
        punto.puntaje > PUNTAJE_MAX)
    ) {
      errores.push(
        `«${nombre}», punto ${punto.numero}: el puntaje debe ser 0, 1 o 2.`,
      );
    }

    if (punto.aves !== null && !Number.isInteger(punto.aves)) {
      errores.push(
        `«${nombre}», punto ${punto.numero}: el número de aves debe ser un entero.`,
      );
    } else if (
      punto.aves !== null &&
      !enRango(punto.aves, reglas.avesMin, reglas.avesMax)
    ) {
      errores.push(
        `«${nombre}», punto ${punto.numero}: en ${reglas.jaula ? 'jaula' : 'piso'} se evalúan entre ${reglas.avesMin} y ${reglas.avesMax} aves por punto.`,
      );
    }

    if (reglas.jaula) {
      if (punto.jaulas !== null && !Number.isInteger(punto.jaulas)) {
        errores.push(
          `«${nombre}», punto ${punto.numero}: el número de jaulas debe ser un entero.`,
        );
      } else if (
        punto.jaulas !== null &&
        !enRango(punto.jaulas, reglas.jaulasMin, reglas.jaulasMax)
      ) {
        errores.push(
          `«${nombre}», punto ${punto.numero}: se muestrean entre ${reglas.jaulasMin} y ${reglas.jaulasMax} jaulas por punto.`,
        );
      }
      if (
        punto.puntaje !== null &&
        (punto.jaulas === null || punto.aves === null)
      ) {
        errores.push(
          `«${nombre}», punto ${punto.numero}: cuente y registre las jaulas y el total de aves antes de calificar (RF21).`,
        );
      }
    }
  }

  return errores;
}

/** Redondea a un número de decimales, sin arrastrar errores de coma flotante. */
export function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function enRango(
  valor: number | null,
  minimo: number | null,
  maximo: number | null,
): boolean {
  return (
    valor !== null &&
    minimo !== null &&
    maximo !== null &&
    valor >= minimo &&
    valor <= maximo
  );
}
