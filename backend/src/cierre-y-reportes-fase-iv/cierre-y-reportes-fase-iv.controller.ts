import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { Roles } from '../common/decorators/acceso.decorators.js';
import { Rol } from '../common/roles.js';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado.interface.js';
import { TipoPredio } from '../visitas/visitas.tipos.js';
import { CerrarVisitaDto } from './dto/cerrar-visita.dto.js';
import { RecibirDocumentosDto } from './dto/recibir-documentos.dto.js';
import { EnviarActaDto } from './dto/enviar-acta.dto.js';
import { CierreYReportesFaseIvService } from './cierre-y-reportes-fase-iv.service.js';

@Controller('modulo7')
export class CierreYReportesFaseIvController {
  constructor(private readonly reportes: CierreYReportesFaseIvService) {}

  @Post('visitas/:visitaId/cerrar')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  cerrarVisita(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @Body() dto: CerrarVisitaDto,
    @UsuarioActual() actor: UsuarioAutenticado,
  ) {
    return this.reportes.cerrarVisita(visitaId, dto, actor);
  }

  @Patch('visitas/:visitaId/documentos')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  recibirDocumentos(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @Body() dto: RecibirDocumentosDto,
    @UsuarioActual() actor: UsuarioAutenticado,
  ) {
    return this.reportes.recibirDocumentos(visitaId, dto, actor);
  }

  @Get('historial')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  historial(
    @UsuarioActual() actor: UsuarioAutenticado,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('predioId') predioId?: string,
    @Query('tipoPredio') tipoPredio?: TipoPredio,
  ) {
    if (tipoPredio && !Object.values(TipoPredio).includes(tipoPredio)) {
      throw new BadRequestException('tipoPredio debe ser CORRAL o TRASPATIO.');
    }
    return this.reportes.historial(actor, { desde, hasta, predioId, tipoPredio });
  }

  @Get('exportar')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  async exportar(
    @UsuarioActual() actor: UsuarioAutenticado,
    @Query('formato') formato: string,
    @Res() respuesta: Response,
  ): Promise<void> {
    if (!['csv', 'xlsx', 'pdf'].includes(formato)) {
      throw new BadRequestException('formato debe ser csv, xlsx o pdf.');
    }
    const archivo = await this.reportes.exportarHistorial(
      actor,
      formato as 'csv' | 'xlsx' | 'pdf',
    );
    respuesta.setHeader('Content-Type', archivo.tipo);
    respuesta.setHeader('Content-Disposition', `attachment; filename="${archivo.nombre}"`);
    respuesta.send(archivo.contenido);
  }

  @Get('predios/:predioId/comparacion')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  comparar(
    @Param('predioId', ParseUUIDPipe) predioId: string,
    @UsuarioActual() actor: UsuarioAutenticado,
  ) {
    return this.reportes.compararVisitas(predioId, actor);
  }

  @Get('visitas/:visitaId/resultados')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  resultados(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @UsuarioActual() actor: UsuarioAutenticado,
  ) {
    return this.reportes.obtenerResultado(visitaId, actor);
  }

  @Get('visitas/:visitaId/acta')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  async acta(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @UsuarioActual() actor: UsuarioAutenticado,
    @Res() respuesta: Response,
  ): Promise<void> {
    const pdf = await this.reportes.obtenerPdf(visitaId, actor);
    respuesta.setHeader('Content-Type', 'application/pdf');
    respuesta.setHeader('Content-Disposition', `inline; filename="acta-${visitaId}.pdf"`);
    respuesta.send(pdf);
  }

  @Post('visitas/:visitaId/enviar')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  enviar(
    @Param('visitaId', ParseUUIDPipe) visitaId: string,
    @Body() dto: EnviarActaDto,
    @UsuarioActual() actor: UsuarioAutenticado,
  ) {
    return this.reportes.enviarActa(visitaId, actor, dto.correo);
  }
}
