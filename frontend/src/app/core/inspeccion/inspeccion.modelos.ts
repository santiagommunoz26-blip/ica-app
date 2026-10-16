/**
 * Modelos de la apertura y ficha general, Fase I (M3 · RF13–RF17).
 * Reflejan lo que devuelve la API (`backend/src/inspeccion/dto`).
 */

import type { EstadoVisita, TipoPredio } from '../visitas/visitas.modelos';

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

/** Respuesta completa de la Fase I (RF13–RF17). */
export interface InspeccionRespuesta {
  visita: VisitaFicha;
  predio: PredioFicha;
  ficha: FichaInspeccion;
  galpones: Galpon[];
  catalogo: Catalogo;
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
    disponible: false,
    modulo: 'M4',
  },
  {
    numero: 3,
    romano: 'III',
    etiqueta: 'Documental',
    disponible: false,
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

  return {
    ...respuesta,
    predio,
    galpones: galpones.map((galpon) => ({
      ...galpon,
      sugerido: sugeridos.includes(galpon.numero),
    })),
    ficha: {
      ...respuesta.ficha,
      grupoProductivo:
        borrador.grupoProductivo !== undefined
          ? borrador.grupoProductivo
          : respuesta.ficha.grupoProductivo,
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
