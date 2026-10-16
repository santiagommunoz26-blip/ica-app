/**
 * Modelos de la apertura y ficha general, Fase I (M3 · RF13–RF17), y de la
 * inspección en galpón, Fase II (M4 · RF18–RF26).
 * Reflejan lo que devuelve la API (`backend/src/inspeccion/dto`).
 */

import type { EstadoVisita, TipoPredio } from '../visitas/visitas.modelos';
import { calcularVisita, type CalculoVisita } from './calculo.modelos';
import {
  claveEvaluacion,
  proyectarFase2,
  reglasFase2,
  type EvaluacionFase2,
  type Fase2,
} from './fase2.modelos';
import {
  proyectarFase3,
  reglasFase3,
  type DocumentoEvaluado,
  type Fase3,
} from './fase3.modelos';

/** Grupos de medidas de la metodología (RF34–RF36). */
export type GrupoMedidas = 'MBA' | 'MBR' | 'MBG';

/** Grupos productivos (RF15). */
export type GrupoProductivo =
  'POLLO_ENGORDE' | 'PONEDORA_PISO' | 'PONEDORA_JAULA';

/** Sistemas de producción (RF13). Lista provisional del proyecto. */
export type SistemaProduccion =
  | 'PISO'
  | 'PASTOREO'
  | 'JAULA'
  | 'ABIERTO_MECANIZADO'
  | 'ABIERTO_NO_MECANIZADO'
  | 'AMBIENTE_CONTROLADO';

/** Opción de una lista (grupo productivo, sistema de producción…). */
export interface OpcionCatalogo {
  codigo: string;
  etiqueta: string;
}

/**
 * Rango de una escala numérica del indicador (M6 · RF38): la medición se
 * convierte en el puntaje cuando es menor o igual a `max`. El último rango
 * lleva `max: null` y recoge «el resto» de la escala.
 */
export interface RangoEscala {
  puntaje: number;
  max: number | null;
}

/**
 * Rangos de un indicador por grupo productivo (M6 · RF30, RF38): la escala
 * puede pedir umbrales distintos según el grupo. Nulo mientras el indicador se
 * califique a ojo con la escala 0/1/2.
 */
export type RangosEscala = Partial<Record<GrupoProductivo, RangoEscala[]>>;

/** Indicador del catálogo (RF46, RF17). */
export interface IndicadorCatalogo {
  codigo: string;
  nombre: string;
  grupo: GrupoMedidas;
  etiquetaGrupo: string;
  metodo: string | null;
  orden: number;
  escalaMin: number;
  escalaMax: number;
  /** Descripción de cada puntaje (RF19), si el catálogo ya la trae. */
  escalaDescripciones: string[] | null;
  /** Forma de muestreo del indicador (RF18, RF22). */
  tipoMuestreo: 'PUNTOS_9' | 'HOJAS_CENTINELA';
  /** Pregunta que resume el indicador (RF47), como en el wireframe. */
  pregunta: string | null;
  /** Forma de calificación del indicador (RF30). */
  tipoEvaluacion: 'PUNTAJE' | 'MORTALIDAD';
  /** Rangos de la escala numérica por grupo productivo (RF38). */
  escalaRangos: RangosEscala | null;
  /** El documento exige firma de MV/MVZ con matrícula vigente (RF28). */
  exigeFirmaProfesional: boolean;
  gruposProductivos: GrupoProductivo[];
}

/** Peso de un grupo de medidas para un perfil de predio (RF14). */
export interface PesoGrupo {
  grupo: GrupoMedidas;
  etiqueta: string;
  peso: number;
}

/** Catálogo de la metodología que acompaña a la Fase I (RF14–RF17). */
export interface Catalogo {
  version: string | null;
  anio: number | null;
  vigenteDesde: string | null;
  provisional: boolean;
  nota: string | null;
  pesosCorral: PesoGrupo[];
  pesosTraspatio: PesoGrupo[];
  gruposProductivos: OpcionCatalogo[];
  sistemasProduccion: OpcionCatalogo[];
  indicadores: IndicadorCatalogo[];
  /** Códigos de indicador aplicables a cada grupo productivo (RF17). */
  aplicables: Record<string, string[]>;
}

/** Predio con su ficha general (RF13, RF14). */
export interface PredioFicha {
  id: string;
  nombre: string;
  municipio: string;
  vereda: string;
  responsable: string | null;
  numeroAves: number | null;
  sistemaProduccion: SistemaProduccion | null;
  etiquetaSistemaProduccion: string | null;
  tipoPredio: TipoPredio;
  etiquetaTipoPredio: string;
}

/** Visita a la que pertenece la inspección. */
export interface VisitaFicha {
  id: string;
  estado: EstadoVisita;
  etiquetaEstado: string;
  programadaPara: string;
  inspector: string;
}

/** Galpón de la Fase I (RF16). */
export interface Galpon {
  id: string;
  numero: number;
  edadSemanas: number | null;
  aves: number | null;
  seleccionado: boolean;
  sugerido: boolean;
}

/** Ficha general de la Fase I (RF13–RF16). */
export interface FichaInspeccion {
  grupoProductivo: GrupoProductivo | null;
  etiquetaGrupoProductivo: string | null;
  fechaHora: string | null;
  observaciones: string | null;
  tipoPredio: TipoPredio;
  etiquetaTipoPredio: string;
  pesos: PesoGrupo[];
  galponesSugeridos: number | null;
  guardada: boolean;
}

/**
 * Respuesta completa de la Fase I (RF13–RF17), la Fase II (RF18–RF26) y la
 * Fase III (RF27–RF33).
 */
export interface InspeccionRespuesta {
  visita: VisitaFicha;
  predio: PredioFicha;
  ficha: FichaInspeccion;
  galpones: Galpon[];
  catalogo: Catalogo;
  /** Inspección en galpón: reglas, evaluaciones, evidencias y avance (M4). */
  fase2: Fase2;
  /** Inspección documental: reglas, documentos y avance (M5). */
  fase3: Fase3;
  /** Resultado del motor de cálculo: grupos, final y clasificación (M6). */
  calculo: CalculoVisita;
  /** Marca solo local: hay cambios guardados en el equipo sin sincronizar. */
  pendiente?: boolean;
}

/** Galpón que se envía al guardar (RF16). */
export interface DatosGalpon {
  numero: number;
  edadSemanas?: number;
  aves?: number;
  seleccionado?: boolean;
}

/** Datos que se guardan en el borrador de la Fase I (RF13–RF16). */
export interface PeticionGuardarInspeccion {
  nombrePredio?: string;
  municipio?: string;
  vereda?: string;
  responsable?: string;
  numeroAves?: number;
  sistemaProduccion?: SistemaProduccion;
  fechaHora?: string;
  grupoProductivo?: GrupoProductivo;
  observaciones?: string;
  galpones?: DatosGalpon[];
  /** Evaluaciones de la Fase II por galpón e indicador (M4 · RF18–RF26). */
  evaluaciones?: EvaluacionFase2[];
  /** Documentos verificados de la Fase III (M5 · RF27–RF31). */
  documentos?: DocumentoEvaluado[];
}

/** Las cuatro fases de la visita, como en el wireframe. */
export const FASES_INSPECCION: readonly {
  numero: number;
  romano: string;
  etiqueta: string;
  disponible: boolean;
  modulo: string;
}[] = [
  {
    numero: 1,
    romano: 'I',
    etiqueta: 'Apertura',
    disponible: true,
    modulo: 'M3',
  },
  {
    numero: 2,
    romano: 'II',
    etiqueta: 'Inspección galpón',
    disponible: true,
    modulo: 'M4',
  },
  {
    numero: 3,
    romano: 'III',
    etiqueta: 'Documental',
    disponible: true,
    modulo: 'M5',
  },
  {
    numero: 4,
    romano: 'IV',
    etiqueta: 'Cierre',
    disponible: false,
    modulo: 'M7',
  },
];

/** A partir de cuántas aves el predio es granja (corral) (RF14). */
export const AVES_CORRAL = 200;

/** A partir de cuántas aves se evalúan dos galpones (RF16). */
export const AVES_DOS_GALPONES = 50000;

/**
 * Clasificación automática del predio (RF14).
 *
 * Es un espejo de `backend/src/inspeccion/inspeccion.reglas.ts`: el servidor es
 * quien manda, pero sin conexión hace falta anticipar la clasificación para
 * mostrar la ficha y los pesos. Si cambia allí, cambia aquí.
 */
export function clasificarPorAves(numeroAves: number): TipoPredio {
  return numeroAves >= AVES_CORRAL ? 'CORRAL' : 'TRASPATIO';
}

/** Cuántos galpones sugiere evaluar la metodología (RF16). Espejo del backend. */
export function galponesSugeridos(numeroAves: number): number {
  return numeroAves >= AVES_DOS_GALPONES ? 2 : 1;
}

/** Indicadores que aplican al grupo productivo elegido (RF17). */
export function indicadoresAplicables(
  catalogo: Catalogo | undefined,
  grupo: GrupoProductivo | '' | null,
): IndicadorCatalogo[] {
  if (!catalogo || !grupo) return [];
  const codigos = new Set(catalogo.aplicables[grupo] ?? []);
  return catalogo.indicadores.filter((indicador) =>
    codigos.has(indicador.codigo),
  );
}

/** Pesos que se aplican según el tipo de predio (RF14). */
export function pesosDe(
  catalogo: Catalogo | undefined,
  tipo: TipoPredio | null,
): PesoGrupo[] {
  if (!catalogo || !tipo) return [];
  return tipo === 'TRASPATIO' ? catalogo.pesosTraspatio : catalogo.pesosCorral;
}

/** Números de los galpones que la metodología sugiere (RF16). */
export function numerosSugeridos(
  galpones: readonly { numero: number; edadSemanas: number | null }[],
  numeroAves: number | null,
): number[] {
  if (numeroAves === null) return [];
  return [...galpones]
    .sort((uno, otro) => (otro.edadSemanas ?? -1) - (uno.edadSemanas ?? -1))
    .slice(0, Math.max(0, galponesSugeridos(numeroAves)))
    .map((galpon) => galpon.numero);
}

/**
 * Aplica un borrador sobre la respuesta que se muestra (RF12, proyección
 * optimista): es lo que verá el inspector mientras el cambio no llega al
 * servidor. Reproduce las reglas de la Fase I (clasificación, pesos y
 * sugerencia de galpones).
 */
export function aplicarBorrador(
  respuesta: InspeccionRespuesta,
  borrador: PeticionGuardarInspeccion,
): InspeccionRespuesta {
  const predio: PredioFicha = {
    ...respuesta.predio,
    nombre: borrador.nombrePredio ?? respuesta.predio.nombre,
    municipio: borrador.municipio ?? respuesta.predio.municipio,
    vereda: borrador.vereda ?? respuesta.predio.vereda,
    responsable:
      borrador.responsable !== undefined
        ? borrador.responsable
        : respuesta.predio.responsable,
    numeroAves:
      borrador.numeroAves !== undefined
        ? borrador.numeroAves
        : respuesta.predio.numeroAves,
    sistemaProduccion:
      borrador.sistemaProduccion !== undefined
        ? borrador.sistemaProduccion
        : respuesta.predio.sistemaProduccion,
  };

  const tipoPredio =
    predio.numeroAves === null
      ? respuesta.predio.tipoPredio
      : clasificarPorAves(predio.numeroAves);

  const galpones: Galpon[] = (borrador.galpones ?? respuesta.galpones).map(
    (datos) => ({
      id: `local-${datos.numero}`,
      numero: datos.numero,
      edadSemanas: datos.edadSemanas ?? null,
      aves: datos.aves ?? null,
      seleccionado: datos.seleccionado ?? false,
      sugerido: false,
    }),
  );
  const sugeridos = numerosSugeridos(galpones, predio.numeroAves);

  const grupoProductivo =
    borrador.grupoProductivo !== undefined
      ? borrador.grupoProductivo
      : respuesta.ficha.grupoProductivo;
  // La Fase II solo evalúa indicadores del animal y de recursos (M4).
  const indicadoresFase2 = indicadoresAplicables(
    respuesta.catalogo,
    grupoProductivo,
  ).filter((indicador) => indicador.grupo !== 'MBG');
  // La Fase III solo evalúa los indicadores de gestión (M5).
  const indicadoresFase3 = indicadoresAplicables(
    respuesta.catalogo,
    grupoProductivo,
  ).filter((indicador) => indicador.grupo === 'MBG');

  const seleccionados = galpones
    .filter((galpon) => galpon.seleccionado)
    .map((galpon) => galpon.numero);
  const reglas2 = reglasFase2(tipoPredio, grupoProductivo);
  const reglas3 = reglasFase3(tipoPredio, grupoProductivo);
  const fase2 = proyectarFase2(
    respuesta.fase2,
    borrador.evaluaciones ?? [],
    indicadoresFase2,
    seleccionados,
    reglas2,
  );
  const fase3 = proyectarFase3(
    respuesta.fase3,
    borrador.documentos ?? [],
    indicadoresFase3,
    reglas3,
  );

  // El resultado se recalcula con cada guardado (RF37), como lo hace el
  // servidor: la interfaz lo muestra en vivo mientras el cambio no llega.
  const calculo = calcularVisita({
    indicadores: indicadoresAplicables(respuesta.catalogo, grupoProductivo),
    pesos: pesosDe(respuesta.catalogo, tipoPredio),
    galpones: seleccionados,
    evaluaciones: fase2.evaluaciones,
    documentos: fase3.documentos,
    fase3Aplica: reglas3.aplica,
    reglasFase2: reglas2,
  });

  return {
    ...respuesta,
    predio,
    galpones: galpones.map((galpon) => ({
      ...galpon,
      sugerido: sugeridos.includes(galpon.numero),
    })),
    fase2,
    fase3,
    calculo,
    ficha: {
      ...respuesta.ficha,
      grupoProductivo,
      fechaHora: borrador.fechaHora ?? respuesta.ficha.fechaHora,
      observaciones:
        borrador.observaciones !== undefined
          ? borrador.observaciones
          : respuesta.ficha.observaciones,
      tipoPredio,
      etiquetaTipoPredio:
        tipoPredio === 'CORRAL' ? 'Granja (corral)' : 'Traspatio',
      pesos: pesosDe(respuesta.catalogo, tipoPredio),
      galponesSugeridos:
        predio.numeroAves === null
          ? null
          : tipoPredio === 'TRASPATIO'
            ? 1
            : sugeridos.length,
      guardada: true,
    },
    pendiente: true,
  };
}

/**
 * Funde dos borradores de la misma inspección (RF12, RF26): el nuevo gana
 * campo a campo, las evaluaciones de la Fase II se mezclan por galpón e
 * indicador y los documentos de la Fase III por indicador. Sirve para que la
 * cola no acumule una copia completa de la ficha por cada guardado sin
 * conexión.
 */
export function fusionarPeticiones(
  anterior: PeticionGuardarInspeccion,
  nuevo: PeticionGuardarInspeccion,
): PeticionGuardarInspeccion {
  const evaluaciones = fusionarEvaluaciones(
    anterior.evaluaciones,
    nuevo.evaluaciones,
  );
  const documentos = fusionarDocumentos(anterior.documentos, nuevo.documentos);
  return {
    ...anterior,
    ...nuevo,
    ...(evaluaciones ? { evaluaciones } : {}),
    ...(documentos ? { documentos } : {}),
  };
}

/** Mezcla dos listas de documentos: la última versión de cada uno gana. */
function fusionarDocumentos(
  anteriores?: DocumentoEvaluado[],
  nuevos?: DocumentoEvaluado[],
): DocumentoEvaluado[] | undefined {
  if (!anteriores && !nuevos) return undefined;
  const porCodigo = new Map<string, DocumentoEvaluado>();
  for (const documento of anteriores ?? []) {
    porCodigo.set(documento.indicadorCodigo, documento);
  }
  for (const documento of nuevos ?? []) {
    porCodigo.set(documento.indicadorCodigo, documento);
  }
  return [...porCodigo.values()];
}

/** Mezcla dos listas de evaluaciones: la última versión de cada una gana. */
function fusionarEvaluaciones(
  anteriores?: EvaluacionFase2[],
  nuevas?: EvaluacionFase2[],
): EvaluacionFase2[] | undefined {
  if (!anteriores && !nuevas) return undefined;
  const porClave = new Map<string, EvaluacionFase2>();
  for (const evaluacion of anteriores ?? []) {
    porClave.set(
      claveEvaluacion(evaluacion.galponNumero, evaluacion.indicadorCodigo),
      evaluacion,
    );
  }
  for (const evaluacion of nuevas ?? []) {
    porClave.set(
      claveEvaluacion(evaluacion.galponNumero, evaluacion.indicadorCodigo),
      evaluacion,
    );
  }
  return [...porClave.values()];
}
