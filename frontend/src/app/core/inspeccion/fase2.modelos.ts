/**
 * Modelos y reglas de la inspección en galpón, Fase II (M4 · RF18–RF26).
 *
 * Espejo de `backend/src/inspeccion/fase2.reglas.ts`: el servidor manda, pero
 * sin conexión (RF12) hay que validar y calcular en el equipo para poder
 * seguir diligenciando la fase.
 */

import type { TipoPredio } from '../visitas/visitas.modelos';
import type {
  GrupoMedidas,
  GrupoProductivo,
  IndicadorCatalogo,
} from './inspeccion.modelos';

/** Un punto de muestreo registrado (RF18–RF21). */
export interface PuntoEvaluado {
  /** Número del punto: 1 a 9, o 1 a N en las hojas centinela (RF18, RF22). */
  numero: number;
  /** Calificación del punto: 0, 1 o 2 (RF19). */
  puntaje: number | null;
  /** Aves evaluadas: 15–30 en piso; total de 10–20 en jaula (RF20, RF21). */
  aves: number | null;
  /** Jaulas muestreadas: 3–5 (RF20); nulo en piso. */
  jaulas: number | null;
}

/** Evaluación de un indicador en un galpón (M4 · RF18–RF26). */
export interface EvaluacionFase2 {
  galponNumero: number;
  indicadorCodigo: string;
  noAplica: boolean;
  motivoNoAplica: string | null;
  observaciones: string | null;
  puntos: PuntoEvaluado[];
  guardadoEn: string;
}

/** Evaluación con lo que el servidor calcula para mostrarla (RF24, RF34). */
export interface EvaluacionRespuesta extends EvaluacionFase2 {
  promedio: number | null;
  valor: number | null;
  puntosRegistrados: number;
  completo: boolean;
}

/** Metadatos de una evidencia (RF23, ADR-003). */
export interface Evidencia {
  id: string;
  galponNumero: number | null;
  indicadorCodigo: string | null;
  nombre: string;
  tipo: string;
  tamano: number;
  confirmada: boolean;
  creadaEn: string;
}

/** Reglas de muestreo de la visita (RF18–RF22). */
export interface ReglasFase2 {
  puntos: number;
  hojasCentinelaMinimo: number;
  jaula: boolean;
  avesMin: number;
  avesMax: number;
  jaulasMin: number | null;
  jaulasMax: number | null;
}

/** Avance de un grupo de medidas en un galpón (RF24). */
export interface AvanceGrupo {
  grupo: GrupoMedidas;
  etiqueta: string;
  completos: number;
  total: number;
}

/** Avance de un galpón, por grupo de medidas (RF24). */
export interface AvanceGalpon {
  galponNumero: number;
  grupos: AvanceGrupo[];
}

/** Todo lo que la Fase II necesita para pintarse (M4 · RF18–RF26). */
export interface Fase2 {
  reglas: ReglasFase2;
  evaluaciones: EvaluacionRespuesta[];
  evidencias: Evidencia[];
  avance: AvanceGalpon[];
}

/** Puntos de muestreo por galpón (RF18). */
export const PUNTOS_MUESTREO = 9;

/** Hojas centinela: mínimo según el tipo de predio (RF22). */
export const HOJAS_CENTINELA_MINIMO: Record<TipoPredio, number> = {
  CORRAL: 3,
  TRASPATIO: 1,
};

/** Muestra en piso: aves por punto (RF20). */
export const MUESTRA_PISO = { avesMin: 15, avesMax: 30 };

/** Muestra en jaula: jaulas y total de aves por punto (RF20). */
export const MUESTRA_JAULA = {
  jaulasMin: 3,
  jaulasMax: 5,
  avesMin: 10,
  avesMax: 20,
};

/** Escala de calificación (RF19). */
export const PUNTAJE_MIN = 0;
export const PUNTAJE_MAX = 2;

/** Tope de puntos de un indicador: acota las hojas centinela (RF22). */
export const MAXIMO_PUNTOS = 30;

/** ¿El grupo productivo se evalúa en jaula? (RF20) */
export function esJaula(
  grupo: GrupoProductivo | '' | null | undefined,
): boolean {
  return grupo === 'PONEDORA_JAULA';
}

/** Reglas de muestreo de la visita (RF18–RF22). Espejo del backend. */
export function reglasFase2(
  tipoPredio: TipoPredio,
  grupo: GrupoProductivo | '' | null,
): ReglasFase2 {
  const jaula = esJaula(grupo);
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

/** Clave de una evaluación dentro de un galpón (galpón + indicador). */
export function claveEvaluacion(
  galponNumero: number,
  indicadorCodigo: string,
): string {
  return `${galponNumero}|${indicadorCodigo}`;
}

/** Evaluación en blanco, como la crea la pantalla al abrir un indicador. */
export function evaluacionVacia(
  galponNumero: number,
  indicadorCodigo: string,
): EvaluacionFase2 {
  return {
    galponNumero,
    indicadorCodigo,
    noAplica: false,
    motivoNoAplica: null,
    observaciones: null,
    puntos: [],
    guardadoEn: '',
  };
}

/** Busca la evaluación de un galpón y un indicador. */
export function buscarEvaluacion<T extends EvaluacionFase2>(
  evaluaciones: readonly T[],
  galponNumero: number,
  indicadorCodigo: string,
): T | undefined {
  return evaluaciones.find(
    (evaluacion) =>
      evaluacion.galponNumero === galponNumero &&
      evaluacion.indicadorCodigo === indicadorCodigo,
  );
}

/** Cuántos puntos pide un indicador: fijos (RF18) o un mínimo (RF22). */
export function puntosRequeridos(
  indicador: IndicadorCatalogo,
  reglas: ReglasFase2,
): { fijos: boolean; minimo: number } {
  return indicador.tipoMuestreo === 'HOJAS_CENTINELA'
    ? { fijos: false, minimo: reglas.hojasCentinelaMinimo }
    : { fijos: true, minimo: reglas.puntos };
}

/** Puntajes registrados (solo los calificados). */
export function puntajesDe(puntos: readonly PuntoEvaluado[]): number[] {
  return puntos
    .map((punto) => punto.puntaje)
    .filter((puntaje): puntaje is number => puntaje !== null);
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

/** ¿La muestra del punto está dentro de lo que pide la metodología? (RF20) */
export function muestraValida(
  punto: PuntoEvaluado,
  reglas: ReglasFase2,
): boolean {
  const avesBien = enRango(punto.aves, reglas.avesMin, reglas.avesMax);
  if (!reglas.jaula) return avesBien;
  return avesBien && enRango(punto.jaulas, reglas.jaulasMin, reglas.jaulasMax);
}

/** Un punto está completo con puntaje y muestra válida (RF19–RF21). */
export function puntoCompleto(
  punto: PuntoEvaluado,
  reglas: ReglasFase2,
): boolean {
  return punto.puntaje !== null && muestraValida(punto, reglas);
}

/** Un indicador completo: todos sus puntos, o «No aplica» con motivo (RF25). */
export function indicadorCompleto(
  evaluacion: EvaluacionFase2 | undefined,
  indicador: IndicadorCatalogo,
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

/** Avance por galpón y grupo de medidas (RF24). Espejo del backend. */
export function avanceDe(
  galpones: readonly number[],
  indicadores: readonly IndicadorCatalogo[],
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
    grupos: (['MBA', 'MBR'] as GrupoMedidas[]).map((grupo) => {
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
        etiqueta: grupo === 'MBA' ? 'Animal (MBA)' : 'Recursos (MBR)',
        completos,
        total: delGrupo.length,
      };
    }),
  }));
}

/**
 * Completa una evaluación con lo que el servidor calcula (promedio, valor y
 * completitud). Se usa para proyectar los borradores sin conexión (RF12).
 */
export function proyectarEvaluacion(
  evaluacion: EvaluacionFase2,
  indicador: IndicadorCatalogo | undefined,
  reglas: ReglasFase2,
): EvaluacionRespuesta {
  const promedio = evaluacion.noAplica
    ? null
    : promedioPuntos(evaluacion.puntos);
  return {
    ...evaluacion,
    promedio,
    valor: valorIndicador(promedio),
    puntosRegistrados: puntajesDe(evaluacion.puntos).length,
    completo: indicador
      ? indicadorCompleto(evaluacion, indicador, reglas)
      : false,
  };
}

/**
 * Proyecta una Fase II completa tras un guardado local (RF12): mezcla las
 * evaluaciones nuevas con las que ya estaban, recalcula cada evaluación y el
 * avance por galpón. Es lo que se muestra mientras el cambio no llega al
 * servidor.
 */
export function proyectarFase2(
  fase2: Fase2,
  evaluaciones: readonly EvaluacionFase2[],
  indicadores: readonly IndicadorCatalogo[],
  galpones: readonly number[],
  reglas: ReglasFase2,
): Fase2 {
  const porClave = new Map<string, EvaluacionRespuesta>();
  for (const evaluacion of fase2.evaluaciones) {
    porClave.set(
      claveEvaluacion(evaluacion.galponNumero, evaluacion.indicadorCodigo),
      evaluacion,
    );
  }
  for (const evaluacion of evaluaciones) {
    const indicador = indicadores.find(
      (fila) => fila.codigo === evaluacion.indicadorCodigo,
    );
    porClave.set(
      claveEvaluacion(evaluacion.galponNumero, evaluacion.indicadorCodigo),
      proyectarEvaluacion(evaluacion, indicador, reglas),
    );
  }

  const lista = [...porClave.values()];
  return {
    ...fase2,
    reglas,
    evaluaciones: lista,
    avance: avanceDe(galpones, indicadores, lista, reglas),
  };
}

/**
 * Mensaje de error de la muestra de un punto, o nulo si está bien (RF20,
 * RF21). Es lo que se muestra bajo el campo mientras se diligencia.
 */
export function mensajeMuestra(
  punto: PuntoEvaluado,
  reglas: ReglasFase2,
): string | null {
  if (
    punto.aves !== null &&
    !enRango(punto.aves, reglas.avesMin, reglas.avesMax)
  ) {
    return reglas.jaula
      ? `En jaula se registran entre ${reglas.avesMin} y ${reglas.avesMax} aves en total por punto.`
      : `En piso se evalúan entre ${reglas.avesMin} y ${reglas.avesMax} aves por punto.`;
  }
  if (
    reglas.jaula &&
    punto.jaulas !== null &&
    !enRango(punto.jaulas, reglas.jaulasMin, reglas.jaulasMax)
  ) {
    return `Se muestrean entre ${reglas.jaulasMin} y ${reglas.jaulasMax} jaulas por punto.`;
  }
  return null;
}

/** Redondea a un número de decimales, sin arrastrar errores de coma flotante. */
export function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/**
 * Revisa una evaluación antes de guardarla (RF19–RF21) y devuelve los
 * problemas encontrados, con mensajes para mostrar tal cual. Espejo del
 * backend: así el guardado no falla al llegar al servidor y un borrador sin
 * conexión no queda rechazado más tarde sin explicación.
 */
export function erroresDeEvaluacion(
  evaluacion: EvaluacionFase2,
  indicador: IndicadorCatalogo,
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
    indicador.tipoMuestreo === 'HOJAS_CENTINELA'
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

/** ¿El valor está dentro del rango cerrado? Nulo si falta algún extremo. */
export function enRango(
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
