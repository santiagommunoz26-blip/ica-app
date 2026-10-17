import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RespuestaIndicadorDto } from './respuesta-indicador.dto.js';

export class CerrarVisitaDto {
  @IsIn([
    'PONEDORA_JAULA',
    'PONEDORA_PISO_PASTOREO',
    'POLLO_ENGORDE',
    'TRASPATIO_PONEDORA',
    'TRASPATIO_POLLO',
  ])
  grupoProductivo: string;

  @IsArray()
  @ArrayUnique((respuesta: RespuestaIndicadorDto) => respuesta.indicadorId)
  @ValidateNested({ each: true })
  @Type(() => RespuestaIndicadorDto)
  respuestas: RespuestaIndicadorDto[];

  @IsBoolean()
  documentosPendientes: boolean;

  @IsOptional()
  @IsEmail()
  correoResponsable?: string;

  @IsString()
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/)
  @MaxLength(2_000_000)
  firmaBase64: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
