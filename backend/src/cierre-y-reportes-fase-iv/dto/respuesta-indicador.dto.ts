import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RespuestaIndicadorDto {
  @IsUUID()
  indicadorId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2)
  puntaje: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;
}

export class ListaRespuestasIndicadorDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaIndicadorDto)
  respuestas: RespuestaIndicadorDto[];
}
