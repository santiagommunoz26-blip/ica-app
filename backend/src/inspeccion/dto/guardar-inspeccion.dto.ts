import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  GrupoProductivo,
  SistemaProduccion,
} from '../../metodologia/metodologia.tipos.js';

/** Un galpón registrado en la Fase I (RF16). */
export class DatosGalponDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 99 })
  @Type(() => Number)
  @IsInt({ message: 'El número de galpón debe ser un entero.' })
  @Min(1, { message: 'El número de galpón debe ser al menos 1.' })
  @Max(99, { message: 'El número de galpón no puede ser mayor que 99.' })
  numero: number;

  @ApiPropertyOptional({ example: 62, description: 'Edad de las aves.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La edad de las aves debe ser un entero (semanas).' })
  @Min(0, { message: 'La edad de las aves no puede ser negativa.' })
  @Max(10000, { message: 'La edad de las aves no puede ser mayor que 10000.' })
  edadSemanas?: number;

  @ApiPropertyOptional({ example: 62000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad de aves del galpón debe ser un entero.' })
  @Min(0, { message: 'La cantidad de aves del galpón no puede ser negativa.' })
  @Max(10000000, {
    message: 'La cantidad de aves del galpón no puede ser mayor que 10000000.',
  })
  aves?: number;

  @ApiPropertyOptional({ description: 'Si se va a inspeccionar (RF16).' })
  @IsOptional()
  @IsBoolean()
  seleccionado?: boolean;
}

/**
 * Guardado de la ficha general del predio y de la Fase I (RF13–RF17).
 *
 * Todos los campos son opcionales porque el borrador se puede guardar por
 * partes; lo que llegue se aplica. El equipo puede reenviar el mismo guardado
 * sin duplicar nada (RF12): la inspección se identifica por la visita.
 */
export class GuardarInspeccionDto {
  @ApiPropertyOptional({ example: 'Granja La Esperanza' })
  @IsOptional()
  @IsString()
  @Length(3, 150)
  nombrePredio?: string;

  @ApiPropertyOptional({ example: 'Fusagasugá' })
  @IsOptional()
  @IsString()
  @Length(3, 120)
  municipio?: string;

  @ApiPropertyOptional({ example: 'El Placer' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  vereda?: string;

  @ApiPropertyOptional({ example: 'Carlos Rojas' })
  @IsOptional()
  @IsString()
  @Length(3, 150)
  responsable?: string;

  @ApiPropertyOptional({
    example: 62000,
    description: 'Número total de aves (capacidad instalada), RF13.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de aves debe ser un entero.' })
  @Min(0, { message: 'El número de aves no puede ser negativo.' })
  @Max(10000000, {
    message: 'El número de aves no puede ser mayor que 10000000.',
  })
  numeroAves?: number;

  @ApiPropertyOptional({
    enum: SistemaProduccion,
    enumName: 'SistemaProduccion',
  })
  @IsOptional()
  @IsEnum(SistemaProduccion)
  sistemaProduccion?: SistemaProduccion;

  @ApiPropertyOptional({ example: '2026-10-09T09:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  fechaHora?: string;

  @ApiPropertyOptional({
    enum: GrupoProductivo,
    enumName: 'GrupoProductivo',
  })
  @IsOptional()
  @IsEnum(GrupoProductivo)
  grupoProductivo?: GrupoProductivo;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  @ApiPropertyOptional({ type: [DatosGalponDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DatosGalponDto)
  galpones?: DatosGalponDto[];
}
