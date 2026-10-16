import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
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
import { InspeccionService } from './inspeccion.service.js';
import { GuardarInspeccionDto } from './dto/guardar-inspeccion.dto.js';
import { InspeccionRespuestaDto } from './dto/inspeccion-respuesta.dto.js';

/**
 * Apertura y ficha general, Fase I (M3 · RF13–RF17).
 *
 * La inspección se identifica por la visita. El alcance por rol (el Inspector
 * solo diligencia sus visitas) lo aplica el servicio con el usuario de la
 * sesión, no el cliente (RNF07).
 */
@ApiTags('inspeccion')
@ApiBearerAuth()
@Controller('inspeccion')
export class InspeccionController {
  constructor(private readonly inspeccion: InspeccionService) {}

  @Get(':visitaId')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  @ApiOperation({
    summary: 'Ficha general y catálogo de una visita (RF13–RF17)',
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
    summary: 'Guarda la ficha general y la Fase I (RF13–RF16)',
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
}
