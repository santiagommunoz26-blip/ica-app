/**
 * Modelos y reglas de la inspección documental, Fase III (M5 · RF27–RF33).
 *
 * Espejo de `backend/src/inspeccion/fase3.reglas.ts`: el servidor manda, pero
 * sin conexión (RF12) hay que validar y calcular en el equipo para poder
 * seguir diligenciando la fase.
 */

import type { TipoPredio } from '../visitas/visitas.modelos';
import { redondear } from './fase2.modelos';
import type { GrupoProductivo, IndicadorCatalogo } from './inspeccion.modelos';

/** Verificación de un documento de gestión (M5 · RF27–RF31). */
export interface DocumentoEvaluado {
  /** Código del indicador de gestión del catálogo (RF27). */
  indicadorCodigo: string;
  /** ¿Se presentó el documento? Nulo mientras no se revise (RF27). */
  presentado: boolean | null;
  /** Legible y sin correcciones ni agregados (RF28). */
  legible: boolean;
  /** Firmado por el responsable de la granja (RF28). */
  firmadoResponsable: boolean;
  /** Firma de MV/MVZ con matrícula vigente; nula si no se exige (RF28). */
  firmadoProfesional: boolean | null;
  /** Tasa de mortalidad acumulada en %; solo el indicador de mortalidad (RF30). */
  mortalidad: number | null;
  /** Puntaje 0–2; automático sin documento (RF29) y en la mortalidad (RF30). */
  puntaje: number | null;
  /** Marcado para entregarlo dentro del plazo de cierre (RF31). */
  pendiente: boolean;
  /** Fecha y hora del último guardado del documento (RF26). */
  guardadoEn: string;
}

/** Documento con lo que el servidor calcula para mostrarlo (RF24, RF31). */
export interface DocumentoRespuesta extends DocumentoEvaluado {
  verificado: boolean;
}

/** Rangos de mortalidad acumulada del grupo productivo (RF30). */
export interface RangosMortalidad {
  /** Hasta aquí, 2 puntos. */
  max2: number;
  /** Hasta aquí, 1 punto; más, 0 puntos. */
  max1: number;
}

/** Reglas de la fase documental (RF30, RF33). */
export interface ReglasFase3 {
  /** Solo en corral; en traspatio no aplica (RF33). */
  aplica: boolean;
  grupoProductivo: GrupoProductivo | null;
  rangosMortalidad: RangosMortalidad | null;
}

/** Avance de la fase documental (RF24, RF27). */
export interface AvanceFase3 {
  verificados: number;
  total: number;
}

/** Todo lo que la Fase III necesita para pintarse (M5 · RF27–RF33). */
export interface Fase3 {
  reglas: ReglasFase3;
  documentos: DocumentoRespuesta[];
  avance: AvanceFase3;
}

/**
 * Rangos de mortalidad acumulada en % (RF30): hasta `max2` son 2 puntos, hasta
 * `max1` es 1, y más de `max1` es 0. Espejo del backend.
 */
export const RANGOS_MORTALIDAD: Record<GrupoProductivo, RangosMortalidad> = {
  POLLO_ENGORDE: { max2: 6, max1: 9 },
  PONEDORA_PISO: { max2: 12, max1: 14 },
  PONEDORA_JAULA: { max2: 12, max1: 14 },
};

/** Decimales admitidos en la tasa de mortalidad. */
export const MORTALIDAD_DECIMALES = 2;

/** Escala de calificación de los documentos (RF19). */
export const PUNTAJE_MIN = 0;
export const PUNTAJE_MAX = 2;

/** ¿El documento se califica por rangos de mortalidad? (RF30) */
export function esMortalidad(indicador: IndicadorCatalogo): boolean {
  return indicador.tipoEvaluacion === 'MORTALIDAD';
}

/** Reglas de la fase documental (RF30, RF33). Espejo del backend. */
export function reglasFase3(
  tipoPredio: TipoPredio,
  grupo: GrupoProductivo | '' | null,
): ReglasFase3 {
  return {
    aplica: tipoPredio === 'CORRAL',
    grupoProductivo: grupo || null,
    rangosMortalidad: grupo ? { ...RANGOS_MORTALIDAD[grupo] } : null,
  };
}

/** Puntaje de la mortalidad por rangos (RF30). Espejo del backend. */
export function puntajeMortalidad(
  tasa: number,
  grupo: GrupoProductivo,
): number {
  const rangos = RANGOS_MORTALIDAD[grupo];
  if (tasa <= rangos.max2) return 2;
  if (tasa <= rangos.max1) return 1;
  return 0;
}

/** Documento en blanco, como lo crea la pantalla al abrir un indicador. */
export function documentoVacio(indicadorCodigo: string): DocumentoEvaluado {
  return {
    indicadorCodigo,
    presentado: null,
    legible: false,
    firmadoResponsable: false,
    firmadoProfesional: null,
    mortalidad: null,
    puntaje: null,
    pendiente: false,
    guardadoEn: '',
  };
}

/** Busca la verificación de un documento por su indicador. */
export function buscarDocumento<T extends DocumentoEvaluado>(
  documentos: readonly T[],
  indicadorCodigo: string,
): T | undefined {
  return documentos.find(
    (documento) => documento.indicadorCodigo === indicadorCodigo,
  );
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
  indicadores: readonly IndicadorCatalogo[],
): AvanceFase3 {
  const porCodigo = new Map(
    documentos.map((documento) => [documento.indicadorCodigo, documento]),
  );
  const verificados = indicadores.filter((indicador) =>
    documentoVerificado(porCodigo.get(indicador.codigo)),
  ).length;
  return { verificados, total: indicadores.length };
}

/** Completa un documento con lo que el servidor calcula (RF31). */
export function proyectarDocumento(
  documento: DocumentoEvaluado,
): DocumentoRespuesta {
  return { ...documento, verificado: documentoVerificado(documento) };
}

/**
 * Proyecta una Fase III completa tras un guardado local (RF12): mezcla las
 * verificaciones nuevas con las que ya estaban, recalcula el visto bueno de
 * cada documento y el avance.
 */
export function proyectarFase3(
  fase3: Fase3,
  documentos: readonly DocumentoEvaluado[],
  indicadores: readonly IndicadorCatalogo[],
  reglas: ReglasFase3,
): Fase3 {
  if (!reglas.aplica) {
    return { reglas, documentos: [], avance: { verificados: 0, total: 0 } };
  }

  const porCodigo = new Map<string, DocumentoRespuesta>();
  for (const documento of fase3.documentos) {
    porCodigo.set(documento.indicadorCodigo, documento);
  }
  for (const documento of documentos) {
    porCodigo.set(documento.indicadorCodigo, proyectarDocumento(documento));
  }

  const lista = [...porCodigo.values()];
  return {
    reglas,
    documentos: lista,
    avance: avanceFase3(lista, indicadores),
  };
}

/**
 * Mensaje de error de la tasa de mortalidad, o nulo si está bien (RF30). Es lo
 * que se muestra bajo el campo mientras se diligencia.
 */
export function mensajeMortalidad(documento: DocumentoEvaluado): string | null {
  const tasa = documento.mortalidad;
  if (tasa === null) return null;
  if (!Number.isFinite(tasa) || tasa < 0 || tasa > 100) {
    return 'La tasa de mortalidad debe estar entre 0 % y 100 %.';
  }
  if (Math.abs(redondear(tasa, MORTALIDAD_DECIMALES) - tasa) > 1e-9) {
    return `Use máximo ${MORTALIDAD_DECIMALES} decimales en la tasa de mortalidad.`;
  }
  return null;
}

/**
 * Revisa un documento antes de guardarlo (RF28–RF30) y devuelve los problemas
 * encontrados, con mensajes para mostrar tal cual. Espejo del backend: así el
 * guardado no falla al llegar al servidor y un borrador sin conexión no queda
 * rechazado más tarde sin explicación.
 */
export function erroresDeDocumento(
  documento: DocumentoEvaluado,
  indicador: IndicadorCatalogo,
  grupo: GrupoProductivo | '' | null,
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

  if (esMortalidad(indicador)) {
    const tasa = documento.mortalidad;
    if (tasa !== null) {
      const mensaje = mensajeMortalidad(documento);
      if (mensaje) {
        errores.push(`«${nombre}»: ${mensaje}`);
      } else if (documento.presentado === true && grupo) {
        // El puntaje sale de los rangos (RF30): no se digita.
        const esperado = puntajeMortalidad(tasa, grupo);
        if (documento.puntaje !== null && documento.puntaje !== esperado) {
          errores.push(
            `«${nombre}»: el puntaje de la mortalidad sale de los rangos de la metodología (RF30).`,
          );
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
