import type { Indicador } from '../metodologia/entities/indicador.entity.js';
import type { CatalogoActivo } from '../metodologia/dto/catalogo-respuesta.dto.js';
import type { MetodologiaService } from '../metodologia/metodologia.service.js';
import type { Predio } from '../visitas/entities/predio.entity.js';
import { TipoPredio } from '../visitas/visitas.tipos.js';
import { calcularVisita } from './calculo.reglas.js';
import type { CalculoVisita } from './calculo.tipos.js';
import { leerEvaluaciones } from './fase2.tipos.js';
import { reglasFase2, type ReglasFase2 } from './fase2.reglas.js';
import { reglasFase3, type ReglasFase3 } from './fase3.reglas.js';
import { leerDocumentos } from './fase3.tipos.js';
import type { Galpon } from './entities/galpon.entity.js';
import type { Inspeccion } from './entities/inspeccion.entity.js';
import { clasificarPorAves } from './inspeccion.reglas.js';

/**
 * Armado del cálculo de una visita (M6 · RF34–RF38), compartido entre la
 * inspección y el cierre (M7 · RF43/RF44).
 *
 * Estas funciones resuelven el contexto de la visita —catalogada por su
 * metodología (RF49), con el tipo de predio clasificado por aves (RF14) y sus
 * reglas de muestreo— y llaman al motor puro. Viven aparte para que el
 * servicio de actas recalcule sin depender del de inspección.
 */

/** Tipo de predio que manda: el clasificado por aves o el declarado (RF14). */
export function tipoPredioDe(predio: Predio): TipoPredio {
  return predio.numeroAves === null
    ? predio.tipoPredio
    : clasificarPorAves(predio.numeroAves);
}

/** Reglas de muestreo de la Fase II para esta visita (RF18–RF22). */
export function reglasDeFase2De(
  predio: Predio,
  inspeccion: Inspeccion | null,
): ReglasFase2 {
  return reglasFase2(tipoPredioDe(predio), inspeccion?.grupoProductivo ?? null);
}

/** Reglas de la fase documental para esta visita (RF30, RF33). */
export function reglasDeFase3De(
  predio: Predio,
  inspeccion: Inspeccion | null,
): ReglasFase3 {
  return reglasFase3(tipoPredioDe(predio), inspeccion?.grupoProductivo ?? null);
}

/** Catálogo que le toca a la inspección: el suyo (RF49) o el vigente. */
export function catalogoDeVisita(
  metodologia: MetodologiaService,
  inspeccion: Inspeccion | null,
): Promise<CatalogoActivo | null> {
  return inspeccion?.metodologiaId
    ? metodologia.porId(inspeccion.metodologiaId)
    : metodologia.activa();
}

/** Indicadores que aplican al grupo productivo elegido (RF17). */
export function indicadoresAplicables(
  catalogo: CatalogoActivo | null,
  grupoProductivo: Inspeccion['grupoProductivo'],
): Indicador[] {
  if (!catalogo || !grupoProductivo) return [];
  return catalogo.indicadores.filter((indicador) =>
    indicador.gruposProductivos.includes(grupoProductivo),
  );
}

/**
 * Corre el motor de cálculo sobre lo que hay guardado (M6).
 *
 * `pendientesCuentanCero` (M7 · RF43) es el modo del cierre: los documentos
 * pendientes cuentan como puntaje 0 para poder firmar la acta provisional.
 */
export function calcularVisitaDe(
  predio: Predio,
  inspeccion: Inspeccion | null,
  catalogo: CatalogoActivo | null,
  galpones: readonly Galpon[],
  opciones: { pendientesCuentanCero?: boolean } = {},
): CalculoVisita {
  const grupoProductivo = inspeccion?.grupoProductivo ?? null;
  return calcularVisita({
    indicadores: indicadoresAplicables(catalogo, grupoProductivo),
    grupoProductivo,
    tipoPredio: tipoPredioDe(predio),
    pesos: catalogo?.pesos ?? [],
    galpones: galpones
      .filter((galpon) => galpon.seleccionado)
      .map((galpon) => galpon.numero),
    evaluaciones: leerEvaluaciones(inspeccion?.respuestas),
    documentos: leerDocumentos(inspeccion?.respuestas),
    fase3Aplica: reglasDeFase3De(predio, inspeccion).aplica,
    reglasFase2: reglasDeFase2De(predio, inspeccion),
    pendientesCuentanCero: opciones.pendientesCuentanCero,
  });
}
