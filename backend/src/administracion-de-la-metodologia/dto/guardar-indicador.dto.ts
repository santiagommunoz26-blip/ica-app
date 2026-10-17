import {
  IsBoolean,
  ArrayUnique,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import type { EscalaIndicador, GrupoMedida } from '../entities/indicador-metodologia.entity.js';

export class GuardarIndicadorDto {
  @IsString()
  @Matches(/^[A-Z0-9_]{2,60}$/)
  clave: string;

  @IsString()
  @MaxLength(180)
  nombre: string;

  @IsIn(['MBA', 'MBR', 'MBG'])
  grupoMedida: GrupoMedida;

  @IsString()
  @MaxLength(80)
  metodoEvaluacion: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(
    [
      'PONEDORA_JAULA',
      'PONEDORA_PISO_PASTOREO',
      'POLLO_ENGORDE',
      'TRASPATIO_PONEDORA',
      'TRASPATIO_POLLO',
    ],
    { each: true },
  )
  gruposProductivos: string[];

  @IsString()
  @MaxLength(100)
  referenciaManual: string;

  @IsObject()
  escalaPuntaje: EscalaIndicador;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
