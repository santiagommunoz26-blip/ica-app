import { ApiProperty } from '@nestjs/swagger';
import type { Indicador } from '../../metodologia/entities/indicador.entity.js';
import { GrupoProductivo } from '../../metodologia/metodologia.tipos.js';
import {
  avanceFase3,
  documentoVerificado,
  type ReglasFase3,
} from '../fase3.reglas.js';
import type { DocumentoEvaluado } from '../fase3.tipos.js';

/**
 * Verificación de un documento de gestión (M5 · RF27–RF31), con lo que la
 * interfaz muestra en vivo.
 */
export class DocumentoRespuestaDto {
  @ApiProperty() indicadorCodigo: string;
  @ApiProperty({ nullable: true }) presentado: boolean | null;
  @ApiProperty() legible: boolean;
  @ApiProperty() firmadoResponsable: boolean;
  @ApiProperty({ nullable: true }) firmadoProfesional: boolean | null;
  @ApiProperty({ nullable: true }) mortalidad: number | null;
  @ApiProperty({ nullable: true }) puntaje: number | null;
  @ApiProperty() pendiente: boolean;
  @ApiProperty({ nullable: true }) guardadoEn: string | null;
  @ApiProperty({
    description: 'Calificado o marcado pendiente: ya se atendió (RF31).',
  })
  verificado: boolean;
}

/** Rangos de mortalidad acumulada del grupo productivo (RF30). */
export class RangosMortalidadRespuestaDto {
  @ApiProperty({ description: 'Hasta aquí, 2 puntos.' })
  max2: number;
  @ApiProperty({ description: 'Hasta aquí, 1 punto; más, 0 puntos.' })
  max1: number;
}

/** Reglas de la fase documental (RF30, RF33). */
export class ReglasFase3RespuestaDto {
  @ApiProperty({
    description: 'Solo en corral; en traspatio no aplica (RF33).',
  })
  aplica: boolean;
  @ApiProperty({
    enum: GrupoProductivo,
    enumName: 'GrupoProductivo',
    nullable: true,
  })
  grupoProductivo: GrupoProductivo | null;
  @ApiProperty({ type: () => RangosMortalidadRespuestaDto, nullable: true })
  rangosMortalidad: RangosMortalidadRespuestaDto | null;
}

/** Avance de la fase documental (RF24, RF27). */
export class AvanceFase3RespuestaDto {
  @ApiProperty() verificados: number;
  @ApiProperty() total: number;
}

/** Todo lo que la Fase III necesita para pintarse (M5 · RF27–RF33). */
export class Fase3RespuestaDto {
  @ApiProperty({ type: () => ReglasFase3RespuestaDto })
  reglas: ReglasFase3RespuestaDto;

  @ApiProperty({ type: () => DocumentoRespuestaDto, isArray: true })
  documentos: DocumentoRespuestaDto[];

  @ApiProperty({ type: () => AvanceFase3RespuestaDto })
  avance: AvanceFase3RespuestaDto;
}

/** Fase III vacía: cuando la visita todavía no tiene datos de esta fase. */
export function fase3Vacia(reglas: ReglasFase3): Fase3RespuestaDto {
  return {
    reglas: { ...reglas, rangosMortalidad: reglas.rangosMortalidad },
    documentos: [],
    avance: { verificados: 0, total: 0 },
  };
}

/**
 * Arma la respuesta de la Fase III (RF27–RF33).
 *
 * `indicadores` son los de gestión (MBG) aplicables al grupo productivo
 * elegido. En traspatio la fase no existe (RF33): la respuesta sale sin
 * documentos, aunque haya algo guardado de una clasificación anterior.
 */
export function mapearFase3(
  reglas: ReglasFase3,
  indicadores: readonly Indicador[],
  documentos: readonly DocumentoEvaluado[],
): Fase3RespuestaDto {
  if (!reglas.aplica) return fase3Vacia(reglas);

  return {
    reglas: { ...reglas, rangosMortalidad: reglas.rangosMortalidad },
    documentos: documentos.map((documento) => ({
      indicadorCodigo: documento.indicadorCodigo,
      presentado: documento.presentado,
      legible: documento.legible,
      firmadoResponsable: documento.firmadoResponsable,
      firmadoProfesional: documento.firmadoProfesional,
      mortalidad: documento.mortalidad,
      puntaje: documento.puntaje,
      pendiente: documento.pendiente,
      guardadoEn: documento.guardadoEn,
      verificado: documentoVerificado(documento),
    })),
    avance: avanceFase3(documentos, indicadores),
  };
}
