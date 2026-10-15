import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LONGITUD_PIN } from '../../common/password.js';

const MENSAJE_PIN = `El PIN debe tener exactamente ${LONGITUD_PIN} dígitos.`;

/**
 * Configuración del PIN de acceso sin conexión (RF03). Se exige la
 * contraseña actual para que nadie configure un PIN en una sesión ajena.
 */
export class ConfigurarPinDto {
  @ApiProperty({
    example: '4829',
    minLength: LONGITUD_PIN,
    maxLength: LONGITUD_PIN,
    description: `PIN de ${LONGITUD_PIN} dígitos.`,
  })
  @IsString()
  @Length(LONGITUD_PIN, LONGITUD_PIN, { message: MENSAJE_PIN })
  @Matches(/^\d+$/, { message: MENSAJE_PIN })
  pin: string;

  @ApiProperty({ example: 'Definitiva2026*', maxLength: 200 })
  @IsString()
  @MinLength(1, { message: 'Debe indicar su contraseña actual.' })
  @MaxLength(200)
  passwordActual: string;
}

/** Verificación del PIN cuando hay conexión (RF03). */
export class VerificarPinDto {
  @ApiProperty({ example: '4829' })
  @IsString()
  @Length(LONGITUD_PIN, LONGITUD_PIN, { message: MENSAJE_PIN })
  @Matches(/^\d+$/, { message: MENSAJE_PIN })
  pin: string;
}
