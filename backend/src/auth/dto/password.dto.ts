import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { LONGITUD_MINIMA_PASSWORD } from '../../common/password.js';

/** Solicitud de recuperación de contraseña (RF06). */
export class RecuperarPasswordDto {
  @ApiProperty({ example: 'ana.ruiz@entidad.gov.co', maxLength: 180 })
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @MaxLength(180)
  correo: string;
}

/** Restablecimiento con el token recibido por correo (RF06). */
export class RestablecerPasswordDto {
  @ApiProperty({ description: 'Token recibido en el correo de recuperación.' })
  @IsString()
  @MinLength(20)
  token: string;

  @ApiProperty({
    example: 'NuevaClave2026*',
    minLength: LONGITUD_MINIMA_PASSWORD,
  })
  @IsString()
  @MinLength(LONGITUD_MINIMA_PASSWORD, {
    message: `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`,
  })
  @MaxLength(200)
  passwordNueva: string;
}

/**
 * Cambio de contraseña del propio usuario. Sirve tanto para el cambio
 * obligatorio del primer acceso (RF07) como para el cambio voluntario.
 */
export class CambiarPasswordDto {
  @ApiProperty({ example: 'Temporal2026*', maxLength: 200 })
  @IsString()
  @MinLength(1, { message: 'Debe indicar la contraseña actual.' })
  @MaxLength(200)
  passwordActual: string;

  @ApiProperty({
    example: 'Definitiva2026*',
    minLength: LONGITUD_MINIMA_PASSWORD,
  })
  @IsString()
  @MinLength(LONGITUD_MINIMA_PASSWORD, {
    message: `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`,
  })
  @MaxLength(200)
  passwordNueva: string;
}
