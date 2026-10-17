import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, Max, Min, ValidateNested } from 'class-validator';
import type { GrupoMedida } from '../entities/indicador-metodologia.entity.js';

class PesoDto {
  @IsIn(['MBA', 'MBR', 'MBG'])
  grupoMedida: GrupoMedida;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  porcentaje: number;
}

export class GuardarPesosDto {
  @IsIn(['CORRAL', 'TRASPATIO'])
  tipoPredio: 'CORRAL' | 'TRASPATIO';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PesoDto)
  pesos: PesoDto[];
}
