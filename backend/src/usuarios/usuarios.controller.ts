import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Rol } from '../common/roles.js';
import { Roles } from '../common/decorators/acceso.decorators.js';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { contextoDePeticion } from '../common/contexto-peticion.js';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado.interface.js';
import { UsuariosService } from './usuarios.service.js';
import { RegistroAccesoService } from './registro-acceso.service.js';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto.js';
import { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import { ListarUsuariosDto } from './dto/listar-usuarios.dto.js';
import { ListarBitacoraDto } from './dto/listar-bitacora.dto.js';
import {
  ListaUsuariosRespuestaDto,
  mapearRegistroAcceso,
  mapearUsuario,
  UsuarioCreadoRespuestaDto,
  UsuarioRespuestaDto,
} from './dto/usuario-respuesta.dto.js';
import { ApiProperty } from '@nestjs/swagger';

/** Página de la bitácora de auditoría. */
class ListaBitacoraRespuestaDto {
  @ApiProperty({ type: [Object] })
  datos: ReturnType<typeof mapearRegistroAcceso>[];

  @ApiProperty({ example: 42 })
  total: number;
}

/**
 * Administración de usuarios (RF05). Solo el rol Administrador puede entrar
 * (RF04, RNF08); el RolesGuard lo garantiza.
 */
@ApiTags('usuarios')
@ApiBearerAuth()
@Roles(Rol.ADMINISTRADOR)
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly bitacora: RegistroAccesoService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuarios con búsqueda y paginación' })
  @ApiOkResponse({ type: ListaUsuariosRespuestaDto })
  async listar(
    @Query() filtros: ListarUsuariosDto,
  ): Promise<ListaUsuariosRespuestaDto> {
    const { datos, total, pagina, porPagina } =
      await this.usuarios.listar(filtros);
    return { datos: datos.map(mapearUsuario), total, pagina, porPagina };
  }

  @Post()
  @ApiOperation({ summary: 'Crea un usuario con contraseña temporal' })
  @ApiOkResponse({ type: UsuarioCreadoRespuestaDto })
  async crear(
    @Body() dto: CrearUsuarioDto,
    @Req() peticion: Request,
    @UsuarioActual() actor: UsuarioAutenticado,
  ): Promise<UsuarioCreadoRespuestaDto> {
    const { usuario, passwordTemporal } = await this.usuarios.crear(dto, {
      ...contextoDePeticion(peticion),
      actorId: actor.id,
    });
    return { usuario: mapearUsuario(usuario), passwordTemporal };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita nombre, correo o rol de un usuario' })
  @ApiOkResponse({ type: UsuarioRespuestaDto })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUsuarioDto,
    @Req() peticion: Request,
    @UsuarioActual() actor: UsuarioAutenticado,
  ): Promise<UsuarioRespuestaDto> {
    const usuario = await this.usuarios.actualizar(id, dto, {
      ...contextoDePeticion(peticion),
      actorId: actor.id,
    });
    return mapearUsuario(usuario);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Activa o inactiva un usuario' })
  @ApiOkResponse({ type: UsuarioRespuestaDto })
  async cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoUsuarioDto,
    @Req() peticion: Request,
    @UsuarioActual() actor: UsuarioAutenticado,
  ): Promise<UsuarioRespuestaDto> {
    const usuario = await this.usuarios.cambiarEstado(id, dto.estado, {
      ...contextoDePeticion(peticion),
      actorId: actor.id,
    });
    return mapearUsuario(usuario);
  }

  @Post(':id/restablecer-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Genera una contraseña temporal nueva para un usuario',
  })
  @ApiOkResponse({ type: UsuarioCreadoRespuestaDto })
  async restablecerPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() peticion: Request,
    @UsuarioActual() actor: UsuarioAutenticado,
  ): Promise<UsuarioCreadoRespuestaDto> {
    const { usuario, passwordTemporal } =
      await this.usuarios.restablecerPasswordPorAdministrador(id, {
        ...contextoDePeticion(peticion),
        actorId: actor.id,
      });
    return { usuario: mapearUsuario(usuario), passwordTemporal };
  }

  @Get('registro-acceso')
  @ApiOperation({ summary: 'Consulta la bitácora de auditoría (RNF11)' })
  @ApiOkResponse({ type: ListaBitacoraRespuestaDto })
  async listarBitacora(
    @Query() filtros: ListarBitacoraDto,
  ): Promise<ListaBitacoraRespuestaDto> {
    const { datos, total } = await this.bitacora.listar(filtros);
    return { datos: datos.map(mapearRegistroAcceso), total };
  }
}
