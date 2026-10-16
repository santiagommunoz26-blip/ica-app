import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { EstadoVisita, TipoPredio } from '../visitas.tipos.js';

/** Filtros y paginación de la lista de visitas (RF11). */
export class ListarVisitasDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  porPagina?: number;

  @ApiPropertyOptional({
    description: 'Busca por nombre del predio, municipio o vereda.',
  })
  @IsOptional()
  @IsString()
  busqueda?: string;

  @ApiPropertyOptional({ description: 'Municipio del predio.' })
  @IsOptional()
  @IsString()
  municipio?: string;

  @ApiPropertyOptional({ enum: EstadoVisita, enumName: 'EstadoVisita' })
  @IsOptional()
  @IsEnum(EstadoVisita)
  estado?: EstadoVisita;

  @ApiPropertyOptional({ enum: TipoPredio, enumName: 'TipoPredio' })
  @IsOptional()
  @IsEnum(TipoPredio)
  tipoPredio?: TipoPredio;

  @ApiPropertyOptional({ description: 'Fecha inicial (inclusive).' })
  @IsOptional()
  @IsISO8601()
  desde?: string;

  @ApiPropertyOptional({ description: 'Fecha final (inclusive).' })
  @IsOptional()
  @IsISO8601()
  hasta?: string;

  @ApiPropertyOptional({
    description:
      'Filtra por inspector. Solo el Administrador puede pedir otro inspector.',
  })
  @IsOptional()
  @IsUUID()
  inspectorId?: string;
}
