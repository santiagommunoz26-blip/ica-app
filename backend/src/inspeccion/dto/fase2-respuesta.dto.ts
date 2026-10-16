import { ApiProperty } from '@nestjs/swagger';
import type { Indicador } from '../../metodologia/entities/indicador.entity.js';
import { GrupoMedidas } from '../../metodologia/metodologia.tipos.js';
import type { Evidencia } from '../entities/evidencia.entity.js';
import {
  avanceDe,
  indicadorCompleto,
  promedioPuntos,
  puntajesDe,
  valorIndicador,
  type ReglasFase2,
} from '../fase2.reglas.js';
import type { EvaluacionFase2, PuntoEvaluado } from '../fase2.tipos.js';

/** Un punto de muestreo tal como lo ve la interfaz (RF18–RF21). */
export class PuntoRespuestaDto {
  @ApiProperty() numero: number;
  @ApiProperty({ nullable: true }) puntaje: number | null;
  @ApiProperty({ nullable: true }) aves: number | null;
  @ApiProperty({ nullable: true }) jaulas: number | null;
}

/** Metadatos de una evidencia (RF23, ADR-003). */
export class EvidenciaRespuestaDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) galponNumero: number | null;
  @ApiProperty({ nullable: true }) indicadorCodigo: string | null;
  @ApiProperty() nombre: string;
  @ApiProperty() tipo: string;
  @ApiProperty() tamano: number;
  @ApiProperty() confirmada: boolean;
  @ApiProperty() creadaEn: string;
}

/** Respuesta al registrar una evidencia: sus metadatos y dónde subirla. */
export class EvidenciaSubidaRespuestaDto {
  @ApiProperty({ type: () => EvidenciaRespuestaDto })
  evidencia: EvidenciaRespuestaDto;

  @ApiProperty({
    description:
      'URL firmada de vida corta para subir el archivo directo al almacenamiento (ADR-003).',
  })
  urlSubida: string;
}

/** Respuesta al pedir una evidencia: la URL firmada de consulta (RNF22). */
export class EvidenciaUrlRespuestaDto {
  @ApiProperty({ description: 'URL firmada de vida corta.' })
  url: string;
}

/**
 * Evaluación de un indicador en un galpón (M4 · RF18–RF26), con lo que la
 * interfaz muestra en vivo: el valor del indicador (RF34) y si está completo.
 */
export class EvaluacionRespuestaDto {
  @ApiProperty() galponNumero: number;
  @ApiProperty() indicadorCodigo: string;
  @ApiProperty() noAplica: boolean;
  @ApiProperty({ nullable: true }) motivoNoAplica: string | null;
  @ApiProperty({ nullable: true }) observaciones: string | null;
  @ApiProperty({ type: () => PuntoRespuestaDto, isArray: true })
  puntos: PuntoRespuestaDto[];
  @ApiProperty({ nullable: true }) guardadoEn: string | null;
  @ApiProperty({ nullable: true, description: 'Promedio de los puntajes.' })
  promedio: number | null;
  @ApiProperty({
    nullable: true,
    description: 'Valor del indicador en % (RF34): promedio × 100 / 2.',
  })
  valor: number | null;
  @ApiProperty({ description: 'Puntos con puntaje registrado.' })
  puntosRegistrados: number;
  @ApiProperty({ description: 'Todos los puntos están calificados (RF24).' })
  completo: boolean;
}

/** Reglas de muestreo de la visita (RF18–RF22). */
export class ReglasFase2RespuestaDto {
  @ApiProperty() puntos: number;
  @ApiProperty() hojasCentinelaMinimo: number;
  @ApiProperty() jaula: boolean;
  @ApiProperty() avesMin: number;
  @ApiProperty() avesMax: number;
  @ApiProperty({ nullable: true }) jaulasMin: number | null;
  @ApiProperty({ nullable: true }) jaulasMax: number | null;
}

/** Avance de un grupo de medidas en un galpón (RF24). */
export class AvanceGrupoRespuestaDto {
  @ApiProperty({ enum: GrupoMedidas, enumName: 'GrupoMedidas' })
  grupo: GrupoMedidas;
  @ApiProperty() etiqueta: string;
  @ApiProperty() completos: number;
  @ApiProperty() total: number;
}

/** Avance de un galpón, por grupo de medidas (RF24). */
export class AvanceGalponRespuestaDto {
  @ApiProperty() galponNumero: number;
  @ApiProperty({ type: () => AvanceGrupoRespuestaDto, isArray: true })
  grupos: AvanceGrupoRespuestaDto[];
}

/** Todo lo que la Fase II necesita para pintarse (M4 · RF18–RF26). */
export class Fase2RespuestaDto {
  @ApiProperty({ type: () => ReglasFase2RespuestaDto })
  reglas: ReglasFase2RespuestaDto;

  @ApiProperty({ type: () => EvaluacionRespuestaDto, isArray: true })
  evaluaciones: EvaluacionRespuestaDto[];

  @ApiProperty({ type: () => EvidenciaRespuestaDto, isArray: true })
  evidencias: EvidenciaRespuestaDto[];

  @ApiProperty({ type: () => AvanceGalponRespuestaDto, isArray: true })
  avance: AvanceGalponRespuestaDto[];
}

/** Fase II vacía: cuando la visita todavía no tiene datos de esta fase. */
export function fase2Vacia(reglas: ReglasFase2): Fase2RespuestaDto {
  return {
    reglas: { ...reglas },
    evaluaciones: [],
    evidencias: [],
    avance: [],
  };
}

/**
 * Arma la respuesta de la Fase II (RF18–RF26).
 *
 * `indicadores` son los aplicables al grupo productivo elegido y de los grupos
 * que evalúa esta fase (MBA y MBR); `galpones` son los números de los galpones
 * marcados para inspeccionar (RF16).
 */
export function mapearFase2(
  reglas: ReglasFase2,
  indicadores: readonly Indicador[],
  galpones: readonly number[],
  evaluaciones: readonly EvaluacionFase2[],
  evidencias: readonly Evidencia[],
): Fase2RespuestaDto {
  const porCodigo = new Map(
    indicadores.map((indicador) => [indicador.codigo, indicador]),
  );

  return {
    reglas: { ...reglas },
    evaluaciones: evaluaciones.map((evaluacion) =>
      mapearEvaluacion(evaluacion, porCodigo, reglas),
    ),
    evidencias: evidencias.map((evidencia) => mapearEvidencia(evidencia)),
    avance: avanceDe(galpones, indicadores, evaluaciones, reglas),
  };
}

/** Metadatos de una evidencia en la forma que espera la interfaz (RF23). */
export function mapearEvidencia(evidencia: Evidencia): EvidenciaRespuestaDto {
  return {
    id: evidencia.id,
    galponNumero: evidencia.galponNumero,
    indicadorCodigo: evidencia.indicadorCodigo,
    nombre: evidencia.nombre,
    tipo: evidencia.tipo,
    tamano: evidencia.tamano,
    confirmada: evidencia.confirmada,
    creadaEn: evidencia.creadaEn.toISOString(),
  };
}

function mapearEvaluacion(
  evaluacion: EvaluacionFase2,
  porCodigo: ReadonlyMap<string, Indicador>,
  reglas: ReglasFase2,
): EvaluacionRespuestaDto {
  const indicador = porCodigo.get(evaluacion.indicadorCodigo);
  const promedio = evaluacion.noAplica
    ? null
    : promedioPuntos(evaluacion.puntos);

  return {
    galponNumero: evaluacion.galponNumero,
    indicadorCodigo: evaluacion.indicadorCodigo,
    noAplica: evaluacion.noAplica,
    motivoNoAplica: evaluacion.motivoNoAplica,
    observaciones: evaluacion.observaciones,
    puntos: evaluacion.puntos.map((punto: PuntoEvaluado) => ({ ...punto })),
    guardadoEn: evaluacion.guardadoEn,
    promedio,
    valor: valorIndicador(promedio),
    puntosRegistrados: puntajesDe(evaluacion.puntos).length,
    completo: indicador
      ? indicadorCompleto(evaluacion, indicador, reglas)
      : false,
  };
}
