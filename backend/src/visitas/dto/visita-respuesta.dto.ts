import { ApiProperty } from '@nestjs/swagger';
import type { Predio } from '../entities/predio.entity.js';
import type { Visita } from '../entities/visita.entity.js';
import type { Usuario } from '../../usuarios/entities/usuario.entity.js';
import {
  Clasificacion,
  ETIQUETA_CLASIFICACION,
  ETIQUETA_ESTADO_VISITA,
  ETIQUETA_TIPO_PREDIO,
  EstadoVisita,
  TRANSICIONES_ESTADO,
  TipoPredio,
  esEditable,
} from '../visitas.tipos.js';

/** Visita con el predio y el inspector ya cargados. */
export type VisitaConRelaciones = Visita & {
  predio: Predio;
  inspector: Usuario;
};

/** Predio tal como lo devuelve la API. */
export class PredioRespuestaDto {
  @ApiProperty() id: string;
  @ApiProperty() nombre: string;
  @ApiProperty() municipio: string;
  @ApiProperty() vereda: string;
  @ApiProperty({ enum: TipoPredio, enumName: 'TipoPredio' })
  tipoPredio: TipoPredio;
  @ApiProperty() etiquetaTipoPredio: string;
}

/** Inspector asignado. */
export class InspectorRespuestaDto {
  @ApiProperty() id: string;
  @ApiProperty() nombreCompleto: string;
}

/** Visita tal como la devuelve la API (RF08, RF09). */
export class VisitaRespuestaDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: PredioRespuestaDto }) predio: PredioRespuestaDto;
  @ApiProperty({ type: InspectorRespuestaDto })
  inspector: InspectorRespuestaDto;
  @ApiProperty() programadaPara: string;
  @ApiProperty({ enum: EstadoVisita, enumName: 'EstadoVisita' })
  estado: EstadoVisita;
  @ApiProperty() etiquetaEstado: string;
  @ApiProperty({ nullable: true }) observaciones: string | null;
  @ApiProperty({ nullable: true, description: 'La calcula M6.' })
  calificacion: number | null;
  @ApiProperty({
    enum: Clasificacion,
    enumName: 'Clasificacion',
    nullable: true,
  })
  clasificacion: Clasificacion | null;
  @ApiProperty({ nullable: true }) etiquetaClasificacion: string | null;
  @ApiProperty({ description: 'Las visitas cerradas no se editan.' })
  editable: boolean;
  @ApiProperty({
    enum: EstadoVisita,
    enumName: 'EstadoVisita',
    isArray: true,
    description: 'Estados a los que puede pasar (RF09).',
  })
  accionesPosibles: EstadoVisita[];
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}

/** Conteo de visitas por estado, para las pestañas del listado (RF11). */
export class ConteosVisitasDto {
  @ApiProperty() todas: number;
  @ApiProperty() programadas: number;
  @ApiProperty() enCurso: number;
  @ApiProperty() pendientesDocumentos: number;
  @ApiProperty() cerradas: number;
}

/** Página de visitas. */
export class ListaVisitasRespuestaDto {
  @ApiProperty({ type: [VisitaRespuestaDto] })
  datos: VisitaRespuestaDto[];
  @ApiProperty() total: number;
  @ApiProperty() pagina: number;
  @ApiProperty() porPagina: number;
  @ApiProperty({ type: ConteosVisitasDto }) conteos: ConteosVisitasDto;
}

/** Convierte una visita a la respuesta de la API. */
export function mapearVisita(visita: VisitaConRelaciones): VisitaRespuestaDto {
  const calificacion =
    visita.calificacion === null || visita.calificacion === undefined
      ? null
      : Number(visita.calificacion);

  return {
    id: visita.id,
    predio: {
      id: visita.predio.id,
      nombre: visita.predio.nombre,
      municipio: visita.predio.municipio,
      vereda: visita.predio.vereda,
      tipoPredio: visita.predio.tipoPredio,
      etiquetaTipoPredio: ETIQUETA_TIPO_PREDIO[visita.predio.tipoPredio],
    },
    inspector: {
      id: visita.inspector.id,
      nombreCompleto: visita.inspector.nombreCompleto,
    },
    programadaPara: visita.programadaPara.toISOString(),
    estado: visita.estado,
    etiquetaEstado: ETIQUETA_ESTADO_VISITA[visita.estado],
    observaciones: visita.observaciones,
    calificacion,
    clasificacion: visita.clasificacion,
    etiquetaClasificacion: visita.clasificacion
      ? ETIQUETA_CLASIFICACION[visita.clasificacion]
      : null,
    editable: esEditable(visita.estado),
    accionesPosibles: [...TRANSICIONES_ESTADO[visita.estado]],
    createdAt: visita.createdAt.toISOString(),
    updatedAt: visita.updatedAt.toISOString(),
  };
}
