import { ApiProperty } from '@nestjs/swagger';
import {
  CatalogoRespuestaDto,
  PesoGrupoRespuestaDto,
} from '../../metodologia/dto/catalogo-respuesta.dto.js';
import {
  ETIQUETA_GRUPO_PRODUCTIVO,
  ETIQUETA_SISTEMA_PRODUCCION,
  GrupoProductivo,
  SistemaProduccion,
} from '../../metodologia/metodologia.tipos.js';
import {
  ETIQUETA_ESTADO_VISITA,
  ETIQUETA_TIPO_PREDIO,
  EstadoVisita,
  TipoPredio,
} from '../../visitas/visitas.tipos.js';
import type { Inspeccion } from '../entities/inspeccion.entity.js';
import type { Galpon } from '../entities/galpon.entity.js';
import type { VisitaConRelaciones } from '../../visitas/dto/visita-respuesta.dto.js';
import { numerosSugeridos, clasificarPorAves } from '../inspeccion.reglas.js';
import { CalculoRespuestaDto } from './calculo-respuesta.dto.js';
import { Fase2RespuestaDto } from './fase2-respuesta.dto.js';
import { Fase3RespuestaDto } from './fase3-respuesta.dto.js';
import { Fase4RespuestaDto } from './fase4-respuesta.dto.js';

/** Predio, con el tipo ya clasificado por el número de aves (RF14). */
export class PredioFichaRespuestaDto {
  @ApiProperty() id: string;
  @ApiProperty() nombre: string;
  @ApiProperty() municipio: string;
  @ApiProperty() vereda: string;
  @ApiProperty({ nullable: true }) responsable: string | null;
  @ApiProperty({ nullable: true }) correoResponsable: string | null;
  @ApiProperty({ nullable: true }) numeroAves: number | null;
  @ApiProperty({
    enum: SistemaProduccion,
    enumName: 'SistemaProduccion',
    nullable: true,
  })
  sistemaProduccion: SistemaProduccion | null;
  @ApiProperty({ nullable: true }) etiquetaSistemaProduccion: string | null;
  @ApiProperty({ enum: TipoPredio, enumName: 'TipoPredio' })
  tipoPredio: TipoPredio;
  @ApiProperty() etiquetaTipoPredio: string;
}

/** Visita a la que pertenece la inspección. */
export class VisitaFichaRespuestaDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: EstadoVisita, enumName: 'EstadoVisita' })
  estado: EstadoVisita;
  @ApiProperty() etiquetaEstado: string;
  @ApiProperty() programadaPara: string;
  @ApiProperty() inspector: string;
}

/** Un galpón, con la marca de si la metodología lo sugiere (RF16). */
export class GalponRespuestaDto {
  @ApiProperty() id: string;
  @ApiProperty() numero: number;
  @ApiProperty({ nullable: true }) edadSemanas: number | null;
  @ApiProperty({ nullable: true }) aves: number | null;
  @ApiProperty() seleccionado: boolean;
  @ApiProperty({ description: 'Lo sugiere la metodología (RF16).' })
  sugerido: boolean;
}

/**
 * Ficha general de la Fase I (RF13–RF16). `guardada` distingue un borrador ya
 * registrado de una visita que todavía no ha empezado su inspección.
 */
export class FichaRespuestaDto {
  @ApiProperty({ nullable: true }) grupoProductivo: GrupoProductivo | null;
  @ApiProperty({ nullable: true }) etiquetaGrupoProductivo: string | null;
  @ApiProperty({ nullable: true }) fechaHora: string | null;
  @ApiProperty({ nullable: true }) observaciones: string | null;
  @ApiProperty({
    enum: TipoPredio,
    enumName: 'TipoPredio',
    description:
      'Clasificación automática por número de aves; mientras no se registre, el tipo declarado (RF14).',
  })
  tipoPredio: TipoPredio;
  @ApiProperty() etiquetaTipoPredio: string;
  @ApiProperty({
    type: () => PesoGrupoRespuestaDto,
    isArray: true,
    description: 'Pesos que se aplican al predio (RF14).',
  })
  pesos: PesoGrupoRespuestaDto[];
  @ApiProperty({
    nullable: true,
    description: 'Galpones que la metodología sugiere evaluar (RF16).',
  })
  galponesSugeridos: number | null;
  @ApiProperty() guardada: boolean;
}

/** Respuesta completa de la Fase I (RF13–RF17). */
export class InspeccionRespuestaDto {
  @ApiProperty({ type: VisitaFichaRespuestaDto })
  visita: VisitaFichaRespuestaDto;

  @ApiProperty({ type: PredioFichaRespuestaDto })
  predio: PredioFichaRespuestaDto;

  @ApiProperty({ type: FichaRespuestaDto })
  ficha: FichaRespuestaDto;

  @ApiProperty({ type: () => GalponRespuestaDto, isArray: true })
  galpones: GalponRespuestaDto[];

  @ApiProperty({ type: CatalogoRespuestaDto })
  catalogo: CatalogoRespuestaDto;

  @ApiProperty({
    type: () => Fase2RespuestaDto,
    description: 'Inspección en galpón, Fase II (M4 · RF18–RF26).',
  })
  fase2: Fase2RespuestaDto;

  @ApiProperty({
    type: () => Fase3RespuestaDto,
    description: 'Inspección documental, Fase III (M5 · RF27–RF33).',
  })
  fase3: Fase3RespuestaDto;

  @ApiProperty({
    type: () => CalculoRespuestaDto,
    description: 'Resultado del motor de cálculo (M6 · RF34–RF38).',
  })
  calculo: CalculoRespuestaDto;

  @ApiProperty({
    type: () => Fase4RespuestaDto,
    description: 'Cierre y acta, Fase IV (M7 · RF39–RF45).',
  })
  fase4: Fase4RespuestaDto;
}

/** Arma la respuesta de la Fase I a partir de lo que hay en la base. */
export function mapearInspeccion(
  visita: VisitaConRelaciones,
  inspeccion: Inspeccion | null,
  galpones: Galpon[],
  catalogo: CatalogoRespuestaDto,
  fase2: Fase2RespuestaDto,
  fase3: Fase3RespuestaDto,
  calculo: CalculoRespuestaDto,
  fase4: Fase4RespuestaDto,
): InspeccionRespuestaDto {
  const predio = visita.predio;
  const numeroAves = predio.numeroAves ?? null;
  // La clasificación la manda el número de aves (RF14); mientras no se haya
  // registrado, se muestra el tipo declarado al programar la visita (M2).
  const tipoPredio =
    numeroAves === null ? predio.tipoPredio : clasificarPorAves(numeroAves);
  const pesos =
    tipoPredio === TipoPredio.TRASPATIO
      ? catalogo.pesosTraspatio
      : catalogo.pesosCorral;

  const sugeridos =
    numeroAves === null ? [] : numerosSugeridos(galpones, numeroAves);

  return {
    visita: {
      id: visita.id,
      estado: visita.estado,
      etiquetaEstado: ETIQUETA_ESTADO_VISITA[visita.estado],
      programadaPara: visita.programadaPara.toISOString(),
      inspector: visita.inspector.nombreCompleto,
    },
    predio: {
      id: predio.id,
      nombre: predio.nombre,
      municipio: predio.municipio,
      vereda: predio.vereda,
      responsable: predio.responsable ?? null,
      correoResponsable: predio.correoResponsable ?? null,
      numeroAves,
      sistemaProduccion: predio.sistemaProduccion ?? null,
      etiquetaSistemaProduccion: predio.sistemaProduccion
        ? ETIQUETA_SISTEMA_PRODUCCION[predio.sistemaProduccion]
        : null,
      tipoPredio: predio.tipoPredio,
      etiquetaTipoPredio: ETIQUETA_TIPO_PREDIO[predio.tipoPredio],
    },
    ficha: {
      grupoProductivo: inspeccion?.grupoProductivo ?? null,
      etiquetaGrupoProductivo: inspeccion?.grupoProductivo
        ? ETIQUETA_GRUPO_PRODUCTIVO[inspeccion.grupoProductivo]
        : null,
      fechaHora: inspeccion?.fechaHora?.toISOString() ?? null,
      observaciones: inspeccion?.observaciones ?? null,
      tipoPredio,
      etiquetaTipoPredio: ETIQUETA_TIPO_PREDIO[tipoPredio],
      pesos,
      galponesSugeridos:
        numeroAves === null
          ? null
          : tipoPredio === TipoPredio.TRASPATIO
            ? 1
            : sugeridos.length,
      guardada: inspeccion !== null,
    },
    galpones: galpones.map((galpon) => ({
      id: galpon.id,
      numero: galpon.numero,
      edadSemanas: galpon.edadSemanas ?? null,
      aves: galpon.aves ?? null,
      seleccionado: galpon.seleccionado,
      sugerido: sugeridos.includes(galpon.numero),
    })),
    catalogo,
    fase2,
    fase3,
    calculo,
    fase4,
  };
}
