import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Rol } from '../../common/roles.js';
import { LONGITUD_MINIMA_PASSWORD } from '../../common/password.js';

/**
 * Datos para crear un usuario (RF05). El administrador elige el rol; la
 * contraseña temporal es opcional: si no se envía, la genera el sistema y la
 * devuelve una sola vez en la respuesta.
 */
export class CrearUsuarioDto {
  @ApiProperty({ example: 'Ana Ruiz', maxLength: 150 })
  @IsString()
  @Length(3, 150, { message: 'El nombre debe tener entre 3 y 150 caracteres.' })
  nombreCompleto: string;

  @ApiProperty({ example: 'ana.ruiz@entidad.gov.co', maxLength: 180 })
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @MaxLength(180)
  correo: string;

  @ApiProperty({
    enum: Rol,
    enumName: 'Rol',
    example: Rol.INSPECTOR,
    description: 'Cada usuario tiene un solo rol (RF04).',
  })
  @IsEnum(Rol, {
    message: 'El rol debe ser ADMINISTRADOR, INSPECTOR o CONSULTA.',
  })
  rol: Rol;

  @ApiPropertyOptional({
    example: 'Temporal2026*',
    minLength: LONGITUD_MINIMA_PASSWORD,
    description:
      'Contraseña temporal. Si se omite, el sistema genera una y la devuelve en la respuesta. El usuario deberá cambiarla en su primer acceso (RF07).',
  })
  @IsOptional()
  @IsString()
  passwordTemporal?: string;
}
