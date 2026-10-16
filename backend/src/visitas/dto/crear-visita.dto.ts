import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DatosPredioDto } from './datos-predio.dto.js';

/**
 * Programación de una visita (RF08): predio, inspector, fecha y hora.
 *
 * - Se indica un predio existente (`predioId`) **o** los datos de uno nuevo
 *   (`predio`), nunca los dos.
 * - El inspector es opcional: si no se indica, la visita queda para el usuario
 *   de la sesión (el inspector programa las suyas).
 * - `id` es opcional y lo propone el equipo cuando la visita se programa sin
 *   conexión, para poder reenviarla sin duplicarla (RF12).
 */
export class CrearVisitaDto {
  @ApiPropertyOptional({
    description: 'Id propuesto por el equipo (programación sin conexión).',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ description: 'Predio ya registrado.' })
  @IsOptional()
  @IsUUID()
  predioId?: string;

  @ApiPropertyOptional({ type: DatosPredioDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DatosPredioDto)
  predio?: DatosPredioDto;

  @ApiPropertyOptional({ description: 'Inspector asignado.' })
  @IsOptional()
  @IsUUID()
  inspectorId?: string;

  @ApiProperty({ example: '2026-10-20T09:00:00.000Z' })
  @IsISO8601()
  programadaPara: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}
