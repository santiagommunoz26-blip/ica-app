import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length } from 'class-validator';
import { TipoPredio } from '../visitas.tipos.js';

/**
 * Datos mínimos del predio al programar una visita (M2).
 *
 * La ficha completa (responsable, número de aves, sistema de producción) la
 * registra la Fase I en M3 (RF13); aquí solo lo que la programación y los
 * filtros necesitan (RF08, RF11).
 */
export class DatosPredioDto {
  @ApiProperty({ example: 'Granja La Esperanza', minLength: 3, maxLength: 150 })
  @IsString()
  @Length(3, 150)
  nombre: string;

  @ApiProperty({ example: 'Sopó', maxLength: 120 })
  @IsString()
  @Length(3, 120)
  municipio: string;

  @ApiProperty({ example: 'Vereda 1', maxLength: 120 })
  @IsString()
  @Length(1, 120)
  vereda: string;

  @ApiProperty({ enum: TipoPredio, enumName: 'TipoPredio' })
  @IsEnum(TipoPredio)
  tipoPredio: TipoPredio;
}
