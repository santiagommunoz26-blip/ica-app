import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
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
import { InspeccionService } from './inspeccion.service.js';
import { EvidenciasService } from './evidencias.service.js';
import { ActasService } from './actas.service.js';
import { CrearEvidenciaDto } from './dto/crear-evidencia.dto.js';
import { EmitirActaDto } from './dto/emitir-acta.dto.js';
import { EnviarActaDto } from './dto/enviar-acta.dto.js';
import { GuardarInspeccionDto } from './dto/guardar-inspeccion.dto.js';
import { InspeccionRespuestaDto } from './dto/inspeccion-respuesta.dto.js';
import {
  ActaUrlRespuestaDto,
  EnvioActaRespuestaDto,
  Fase4RespuestaDto,
} from './dto/fase4-respuesta.dto.js';
import {
  EvidenciaRespuestaDto,
  EvidenciaSubidaRespuestaDto,
  EvidenciaUrlRespuestaDto,
} from './dto/fase2-respuesta.dto.js';

/**
 * Apertura y ficha general (Fase I, M3 · RF13–RF17) e inspección en galpón
 * (Fase II, M4 · RF18–RF26).
 *
 * La inspección se identifica por la visita. El alcance por rol (el Inspector
 * solo diligencia sus visitas) lo aplica el servicio con el usuario de la
 * sesión, no el cliente (RNF07).
 */
@ApiTags('inspeccion')
@ApiBearerAuth()
@Controller('inspeccion')
export class InspeccionController {
  constructor(
    private readonly inspeccion: InspeccionService,
    private readonly evidencias: EvidenciasService,
    private readonly actas: ActasService,
  ) {}

  @Get(':visitaId')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  @ApiOperation({
    summary: 'Ficha general, catálogo y Fase II de una visita (RF13–RF26)',
  })
  @ApiOkResponse({ type: InspeccionRespuestaDto })
  obtener(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<InspeccionRespuestaDto> {
    return this.inspeccion.obtener(visitaId, usuario);
  }

  @Put(':visitaId')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  @ApiOperation({
    summary:
      'Guarda la ficha general, la Fase I y las evaluaciones de la Fase II (RF13–RF26)',
  })
  @ApiOkResponse({ type: InspeccionRespuestaDto })
  guardar(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @Body() dto: GuardarInspeccionDto,
    @Req() peticion: Request,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<InspeccionRespuestaDto> {
    return this.inspeccion.guardar(visitaId, dto, usuario, {
      ...contextoDePeticion(peticion),
      actorId: usuario.id,
    });
  }

  // ------------------------------------------------------- evidencias (RF23)

  @Post(':visitaId/evidencias')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  @ApiOperation({
    summary:
      'Registra una evidencia y devuelve la URL firmada para subirla (RF23)',
  })
  @ApiCreatedResponse({ type: EvidenciaSubidaRespuestaDto })
  crearEvidencia(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @Body() dto: CrearEvidenciaDto,
    @Req() peticion: Request,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<EvidenciaSubidaRespuestaDto> {
    return this.evidencias.crear(visitaId, dto, usuario, {
      ...contextoDePeticion(peticion),
      actorId: usuario.id,
    });
  }

  @Post('evidencias/:id/confirmar')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  @ApiOperation({
    summary: 'Confirma que la evidencia llegó al almacenamiento (RF23)',
  })
  @ApiOkResponse({ type: EvidenciaRespuestaDto })
  confirmarEvidencia(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<EvidenciaRespuestaDto> {
    return this.evidencias.confirmar(id, usuario);
  }

  @Get('evidencias/:id/url')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  @ApiOperation({
    summary: 'URL firmada de vida corta para consultar la evidencia (RNF22)',
  })
  @ApiOkResponse({ type: EvidenciaUrlRespuestaDto })
  async urlEvidencia(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<EvidenciaUrlRespuestaDto> {
    return { url: await this.evidencias.url(id, usuario) };
  }

  @Delete('evidencias/:id')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  @HttpCode(204)
  @ApiOperation({ summary: 'Borra una evidencia (RF23)' })
  @ApiNoContentResponse()
  eliminarEvidencia(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() peticion: Request,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<void> {
    return this.evidencias.eliminar(id, usuario, {
      ...contextoDePeticion(peticion),
      actorId: usuario.id,
    });
  }

  // ------------------------------------------- cierre y actas (RF39–RF45, M7)

  @Post(':visitaId/acta')
  @Roles(Rol.INSPECTOR)
  @ApiOperation({
    summary:
      'Firma el acta y cierra la visita; con pendientes abre el plazo (RF41–RF43)',
  })
  @ApiCreatedResponse({ type: Fase4RespuestaDto })
  emitirActa(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @Body() dto: EmitirActaDto,
    @Req() peticion: Request,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Fase4RespuestaDto> {
    return this.actas.emitir(visitaId, dto, usuario, {
      ...contextoDePeticion(peticion),
      actorId: usuario.id,
    });
  }

  @Post(':visitaId/acta/correo')
  @Roles(Rol.INSPECTOR)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Envía el acta al responsable del predio por correo (RF45)',
  })
  @ApiOkResponse({ type: EnvioActaRespuestaDto })
  enviarActa(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @Body() dto: EnviarActaDto,
    @Req() peticion: Request,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<EnvioActaRespuestaDto> {
    return this.actas.enviar(visitaId, dto, usuario, {
      ...contextoDePeticion(peticion),
      actorId: usuario.id,
    });
  }

  @Get(':visitaId/acta/descarga')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  @ApiOperation({
    summary: 'URL firmada de vida corta para descargar el acta (RNF22)',
  })
  @ApiOkResponse({ type: ActaUrlRespuestaDto })
  async urlActa(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<ActaUrlRespuestaDto> {
    return { url: await this.actas.urlDescarga(visitaId, usuario) };
  }
}
