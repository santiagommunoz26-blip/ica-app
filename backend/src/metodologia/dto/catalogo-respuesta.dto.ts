import { ApiProperty } from '@nestjs/swagger';
import { TipoPredio } from '../../visitas/visitas.tipos.js';
import type { Indicador } from '../entities/indicador.entity.js';
import type { Metodologia } from '../entities/metodologia.entity.js';
import type { PesoGrupo } from '../entities/peso-grupo.entity.js';
import {
  ETIQUETA_GRUPO_MEDIDAS,
  ETIQUETA_GRUPO_PRODUCTIVO,
  ETIQUETA_SISTEMA_PRODUCCION,
  GrupoMedidas,
  GrupoProductivo,
  ORDEN_GRUPOS_MEDIDAS,
  ORDEN_GRUPOS_PRODUCTIVOS,
  ORDEN_SISTEMAS_PRODUCCION,
} from '../metodologia.tipos.js';

/** Versión activa del catálogo con sus indicadores y sus pesos. */
export interface CatalogoActivo {
  metodologia: Metodologia;
  indicadores: Indicador[];
  pesos: PesoGrupo[];
}

/** Opción de una lista (grupo productivo, sistema de producción…). */
export class OpcionRespuestaDto {
  @ApiProperty() codigo: string;
  @ApiProperty() etiqueta: string;
}

/** Indicador del catálogo tal como lo ve la interfaz (RF46, RF17). */
export class IndicadorRespuestaDto {
  @ApiProperty() codigo: string;
  @ApiProperty() nombre: string;
  @ApiProperty({ enum: GrupoMedidas, enumName: 'GrupoMedidas' })
  grupo: GrupoMedidas;
  @ApiProperty() etiquetaGrupo: string;
  @ApiProperty({ nullable: true }) metodo: string | null;
  @ApiProperty() orden: number;
  @ApiProperty() escalaMin: number;
  @ApiProperty() escalaMax: number;
  @ApiProperty({
    enum: GrupoProductivo,
    enumName: 'GrupoProductivo',
    isArray: true,
    description: 'Grupos productivos a los que aplica (RF17).',
  })
  gruposProductivos: GrupoProductivo[];
}

/** Peso de un grupo de medidas para un perfil de predio (RF14, RF48). */
export class PesoGrupoRespuestaDto {
  @ApiProperty({ enum: GrupoMedidas, enumName: 'GrupoMedidas' })
  grupo: GrupoMedidas;
  @ApiProperty() etiqueta: string;
  @ApiProperty({ description: 'Porcentaje del grupo, 0–100.' })
  peso: number;
}

/**
 * Catálogo de la metodología que acompaña a la Fase I (RF14–RF17): pesos por
 * perfil, grupos productivos, sistemas de producción e indicadores, con el
 * reparto de indicadores aplicables por grupo productivo.
 */
export class CatalogoRespuestaDto {
  @ApiProperty({ nullable: true }) version: string | null;
  @ApiProperty({ nullable: true }) anio: number | null;
  @ApiProperty({ nullable: true }) vigenteDesde: string | null;
  @ApiProperty({
    description:
      'Verdadero mientras el catálogo sea el provisional del proyecto y no el del manual ICA.',
  })
  provisional: boolean;
  @ApiProperty({ nullable: true }) nota: string | null;

  @ApiProperty({ type: () => PesoGrupoRespuestaDto, isArray: true })
  pesosCorral: PesoGrupoRespuestaDto[];

  @ApiProperty({ type: () => PesoGrupoRespuestaDto, isArray: true })
  pesosTraspatio: PesoGrupoRespuestaDto[];

  @ApiProperty({ type: () => OpcionRespuestaDto, isArray: true })
  gruposProductivos: OpcionRespuestaDto[];

  @ApiProperty({ type: () => OpcionRespuestaDto, isArray: true })
  sistemasProduccion: OpcionRespuestaDto[];

  @ApiProperty({ type: () => IndicadorRespuestaDto, isArray: true })
  indicadores: IndicadorRespuestaDto[];

  @ApiProperty({
    description:
      'Códigos de indicador aplicables a cada grupo productivo (RF17).',
    example: { POLLO_ENGORDE: ['MBA-01', 'MBR-01'] },
  })
  aplicables: Record<string, string[]>;
}

/** Catálogo vacío: cuando todavía no hay ninguna versión cargada. */
export function catalogoVacio(): CatalogoRespuestaDto {
  return {
    version: null,
    anio: null,
    vigenteDesde: null,
    provisional: true,
    nota: null,
    pesosCorral: [],
    pesosTraspatio: [],
    gruposProductivos: opcionesGruposProductivos(),
    sistemasProduccion: opcionesSistemasProduccion(),
    indicadores: [],
    aplicables: {},
  };
}

/** Convierte la versión activa en la respuesta de la API (RF17). */
export function mapearCatalogo(catalogo: CatalogoActivo): CatalogoRespuestaDto {
  const indicadores = [...catalogo.indicadores].sort(
    (uno, otro) =>
      ORDEN_GRUPOS_MEDIDAS.indexOf(uno.grupo) -
        ORDEN_GRUPOS_MEDIDAS.indexOf(otro.grupo) || uno.orden - otro.orden,
  );

  return {
    version: catalogo.metodologia.version,
    anio: catalogo.metodologia.anio,
    vigenteDesde: catalogo.metodologia.vigenteDesde,
    provisional: catalogo.metodologia.provisional,
    nota: catalogo.metodologia.nota,
    pesosCorral: pesosDePerfil(catalogo.pesos, TipoPredio.CORRAL),
    pesosTraspatio: pesosDePerfil(catalogo.pesos, TipoPredio.TRASPATIO),
    gruposProductivos: opcionesGruposProductivos(),
    sistemasProduccion: opcionesSistemasProduccion(),
    indicadores: indicadores.map((indicador) => ({
      codigo: indicador.codigo,
      nombre: indicador.nombre,
      grupo: indicador.grupo,
      etiquetaGrupo: ETIQUETA_GRUPO_MEDIDAS[indicador.grupo],
      metodo: indicador.metodo,
      orden: indicador.orden,
      escalaMin: indicador.escalaMin,
      escalaMax: indicador.escalaMax,
      gruposProductivos: indicador.gruposProductivos,
    })),
    aplicables: aplicablesPorGrupo(indicadores),
  };
}

/** Indicadores aplicables a cada grupo productivo, en orden (RF17). */
function aplicablesPorGrupo(
  indicadores: Indicador[],
): Record<string, string[]> {
  const resultado: Record<string, string[]> = {};
  for (const grupo of ORDEN_GRUPOS_PRODUCTIVOS) {
    resultado[grupo] = indicadores
      .filter((indicador) => indicador.gruposProductivos.includes(grupo))
      .map((indicador) => indicador.codigo);
  }
  return resultado;
}

/** Pesos de un perfil, en el orden de los grupos de medidas. */
function pesosDePerfil(
  pesos: PesoGrupo[],
  perfil: TipoPredio,
): PesoGrupoRespuestaDto[] {
  return ORDEN_GRUPOS_MEDIDAS.map((grupo) => {
    const fila = pesos.find(
      (peso) => peso.perfil === perfil && peso.grupo === grupo,
    );
    return {
      grupo,
      etiqueta: ETIQUETA_GRUPO_MEDIDAS[grupo],
      peso: fila ? Number(fila.peso) : 0,
    };
  });
}

/** Grupos productivos ofrecidos por la interfaz (RF15). */
function opcionesGruposProductivos(): OpcionRespuestaDto[] {
  return ORDEN_GRUPOS_PRODUCTIVOS.map((codigo) => ({
    codigo,
    etiqueta: ETIQUETA_GRUPO_PRODUCTIVO[codigo],
  }));
}

/** Sistemas de producción ofrecidos por la interfaz (RF13, lista provisional). */
function opcionesSistemasProduccion(): OpcionRespuestaDto[] {
  return ORDEN_SISTEMAS_PRODUCCION.map((codigo) => ({
    codigo,
    etiqueta: ETIQUETA_SISTEMA_PRODUCCION[codigo],
  }));
}
