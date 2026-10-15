import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Credenciales de inicio de sesión (RF01). */
export class IniciarSesionDto {
  @ApiProperty({ example: 'ana.ruiz@entidad.gov.co', maxLength: 180 })
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @MaxLength(180)
  correo: string;

  @ApiProperty({ example: 'Secreta2026*', maxLength: 200 })
  @IsString()
  @MinLength(1, { message: 'Debe indicar la contraseña.' })
  @MaxLength(200)
  password: string;

  @ApiPropertyOptional({
    default: false,
    description:
      '«Recordarme en este equipo»: la sesión permanece más tiempo (ver JWT_REFRESH_DIAS_RECORDAR).',
  })
  @IsOptional()
  @IsBoolean()
  recordarme?: boolean;
}

/** Token de refresco para renovar el acceso (RF02). */
export class RefrescarSesionDto {
  @ApiProperty({
    description: 'Token de refresco entregado al iniciar sesión.',
  })
  @IsString()
  @MinLength(20)
  token: string;
}

/** Datos para cerrar la sesión (RF02). */
export class CerrarSesionDto {
  @ApiPropertyOptional({
    description:
      'Token de refresco de la sesión a cerrar. Si se omite, se cierran todas las sesiones del usuario.',
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  token?: string;
}
