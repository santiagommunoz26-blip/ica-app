import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ETIQUETA_ROL, permisosDeRol, Rol } from '../common/roles.js';
import { Roles } from '../common/decorators/acceso.decorators.js';
import { RolRespuestaDto } from './dto/rol-respuesta.dto.js';

/**
 * Catálogo de roles y permisos (RF04). La pantalla de usuarios lo usa para
 * mostrar «Permisos del rol» al elegir el rol de un usuario.
 */
@ApiTags('roles')
@ApiBearerAuth()
@Roles(Rol.ADMINISTRADOR)
@Controller('roles')
export class RolesController {
  @Get()
  @ApiOperation({ summary: 'Lista los roles del sistema y sus permisos' })
  @ApiOkResponse({ type: [RolRespuestaDto] })
  listar(): RolRespuestaDto[] {
    return Object.values(Rol).map((rol) => ({
      rol,
      etiqueta: ETIQUETA_ROL[rol],
      permisos: permisosDeRol(rol),
    }));
  }
}
