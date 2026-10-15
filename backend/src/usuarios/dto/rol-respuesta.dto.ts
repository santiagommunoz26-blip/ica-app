import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '../../common/roles.js';

/** Permiso con su etiqueta y si el rol lo tiene concedido. */
export class PermisoRolRespuestaDto {
  @ApiProperty({ example: 'visitas:crear' })
  clave: string;

  @ApiProperty({ example: 'Crear y programar visitas' })
  etiqueta: string;

  @ApiProperty({ example: true })
  concedido: boolean;
}

/** Catálogo de roles y sus permisos (RF04), usado por la pantalla de usuarios. */
export class RolRespuestaDto {
  @ApiProperty({ enum: Rol, enumName: 'Rol' })
  rol: Rol;

  @ApiProperty({ example: 'Inspector' })
  etiqueta: string;

  @ApiProperty({ type: [PermisoRolRespuestaDto] })
  permisos: PermisoRolRespuestaDto[];
}
