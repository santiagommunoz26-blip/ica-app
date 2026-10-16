import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Tipos de archivo admitidos hoy: fotos (RF23). */
export const TIPOS_EVIDENCIA = ['image/jpeg', 'image/png', 'image/webp'];

/** Tamaño máximo de una evidencia: 8 MB. */
export const TAMANO_MAXIMO_EVIDENCIA = 8 * 1024 * 1024;

/**
 * Registro de una evidencia (RF23, ADR-003).
 *
 * El binario no viene aquí: esto solo pide la **URL firmada** de subida y
 * guarda los metadatos. El límite de tamaño y los tipos permitidos se validan
 * **antes** de firmar (ADR-003); el video corto queda pendiente de definir su
 * tamaño y duración.
 */
export class CrearEvidenciaDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Galpón al que pertenece (RF16).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de galpón debe ser un entero.' })
  @Min(1, { message: 'El número de galpón debe ser al menos 1.' })
  @Max(99, { message: 'El número de galpón no puede ser mayor que 99.' })
  galponNumero?: number;

  @ApiPropertyOptional({
    example: 'MBR-01',
    description: 'Indicador al que acompaña (RF23).',
  })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  indicadorCodigo?: string;

  @ApiProperty({ example: 'cama-galpon-1.jpg' })
  @IsString()
  @Length(1, 255, {
    message: 'El nombre del archivo debe tener entre 1 y 255 caracteres.',
  })
  nombre: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsIn(TIPOS_EVIDENCIA, {
    message: 'Solo se admiten fotos JPG, PNG o WebP.',
  })
  tipo: string;

  @ApiProperty({ example: 240000, description: 'Tamaño en bytes.' })
  @Type(() => Number)
  @IsInt({ message: 'El tamaño del archivo debe ser un entero.' })
  @Min(1, { message: 'El tamaño del archivo debe ser mayor que cero.' })
  @Max(TAMANO_MAXIMO_EVIDENCIA, {
    message: 'La foto no puede pesar más de 8 MB.',
  })
  tamano: number;

  @ApiPropertyOptional({
    description: 'Huella SHA-256 del archivo (hexadecimal).',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{64}$/, {
    message: 'La huella del archivo no es válida.',
  })
  hash?: string;
}
