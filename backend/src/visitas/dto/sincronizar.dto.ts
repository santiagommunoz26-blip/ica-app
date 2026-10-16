import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ActualizarVisitaDto } from './actualizar-visita.dto.js';
import { CambiarEstadoVisitaDto } from './cambiar-estado-visita.dto.js';
import { CrearVisitaDto } from './crear-visita.dto.js';
import { GuardarInspeccionDto } from '../../inspeccion/dto/guardar-inspeccion.dto.js';

/** Operación guardada en el equipo mientras no había conexión (RF12). */
export enum TipoOperacionSincronizacion {
  CREAR_VISITA = 'CREAR_VISITA',
  ACTUALIZAR_VISITA = 'ACTUALIZAR_VISITA',
  CAMBIAR_ESTADO = 'CAMBIAR_ESTADO',
  /** Ficha de la Fase I guardada sin conexión (M3 · RF13–RF16). */
  GUARDAR_INSPECCION = 'GUARDAR_INSPECCION',
}

/**
 * Una operación hecha sin conexión.
 *
 * El equipo propone el `visitaId`, así que reenviar el mismo lote no duplica
 * nada: si la visita ya existe, la operación de creación se da por aplicada.
 */
export class OperacionSincronizacionDto {
  @ApiProperty({ description: 'Identificador de la operación en el equipo.' })
  @IsUUID()
  id: string;

  @ApiProperty({
    enum: TipoOperacionSincronizacion,
    enumName: 'TipoOperacionSincronizacion',
  })
  @IsEnum(TipoOperacionSincronizacion)
  tipo: TipoOperacionSincronizacion;

  @ApiPropertyOptional({ description: 'Visita afectada.' })
  @IsOptional()
  @IsUUID()
  visitaId?: string;

  @ApiPropertyOptional({ type: CrearVisitaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CrearVisitaDto)
  crear?: CrearVisitaDto;

  @ApiPropertyOptional({ type: ActualizarVisitaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ActualizarVisitaDto)
  actualizar?: ActualizarVisitaDto;

  @ApiPropertyOptional({ type: CambiarEstadoVisitaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CambiarEstadoVisitaDto)
  estado?: CambiarEstadoVisitaDto;

  @ApiPropertyOptional({ type: GuardarInspeccionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GuardarInspeccionDto)
  inspeccion?: GuardarInspeccionDto;

  @ApiProperty({ description: 'Cuándo se hizo la operación en el equipo.' })
  @IsISO8601()
  registradoEn: string;
}

/** Lote de operaciones pendientes de sincronizar (RF12). */
export class SincronizarVisitasDto {
  @ApiProperty({ type: [OperacionSincronizacionDto], maxItems: 200 })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OperacionSincronizacionDto)
  operaciones: OperacionSincronizacionDto[];
}

/** Resultado de una operación. */
export class ResultadoSincronizacionDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['APLICADA', 'RECHAZADA'] })
  estado: 'APLICADA' | 'RECHAZADA';
  @ApiPropertyOptional() motivo?: string;
}
