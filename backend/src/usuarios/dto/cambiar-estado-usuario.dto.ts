import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoUsuario } from '../../common/roles.js';

/** Activa o inactiva un usuario (RF05). Un usuario inactivo no ingresa. */
export class CambiarEstadoUsuarioDto {
  @ApiProperty({ enum: EstadoUsuario, enumName: 'EstadoUsuario' })
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser ACTIVO o INACTIVO.',
  })
  estado: EstadoUsuario;
}
