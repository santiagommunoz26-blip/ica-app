import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Rol } from '../../common/roles.js';

/** Datos editables de un usuario (RF05). El estado se cambia aparte. */
export class ActualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'Ana María Ruiz', maxLength: 150 })
  @IsOptional()
  @IsString()
  @Length(3, 150, { message: 'El nombre debe tener entre 3 y 150 caracteres.' })
  nombreCompleto?: string;

  @ApiPropertyOptional({ example: 'ana.ruiz@entidad.gov.co', maxLength: 180 })
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @MaxLength(180)
  correo?: string;

  @ApiPropertyOptional({ enum: Rol, enumName: 'Rol' })
  @IsOptional()
  @IsEnum(Rol, {
    message: 'El rol debe ser ADMINISTRADOR, INSPECTOR o CONSULTA.',
  })
  rol?: Rol;
}
