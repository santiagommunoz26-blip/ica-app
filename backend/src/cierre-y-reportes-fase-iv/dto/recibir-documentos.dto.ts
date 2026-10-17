import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { RespuestaIndicadorDto } from './respuesta-indicador.dto.js';

export class RecibirDocumentosDto {
  @IsArray()
  @IsOptional()
  @ArrayUnique((respuesta: RespuestaIndicadorDto) => respuesta.indicadorId)
  @ValidateNested({ each: true })
  @Type(() => RespuestaIndicadorDto)
  respuestas?: RespuestaIndicadorDto[];
}
