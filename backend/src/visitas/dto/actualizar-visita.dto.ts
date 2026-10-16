import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Cambios permitidos en una visita programada (RF08, RF09). */
export class ActualizarVisitaDto {
  @ApiPropertyOptional({ description: 'Predio ya registrado.' })
  @IsOptional()
  @IsUUID()
  predioId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inspectorId?: string;

  @ApiPropertyOptional({ example: '2026-10-21T08:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  programadaPara?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}
