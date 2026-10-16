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
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Rol } from '../common/roles.js';
import { Roles } from '../common/decorators/acceso.decorators.js';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { contextoDePeticion } from '../common/contexto-peticion.js';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado.interface.js';
import { VisitasService } from './visitas.service.js';
import { ActualizarVisitaDto } from './dto/actualizar-visita.dto.js';
import { CambiarEstadoVisitaDto } from './dto/cambiar-estado-visita.dto.js';
import { CrearVisitaDto } from './dto/crear-visita.dto.js';
import { ListarVisitasDto } from './dto/listar-visitas.dto.js';
import { ResumenPanelDto } from './dto/resumen-panel.dto.js';
import {
  ResultadoSincronizacionDto,
  SincronizarVisitasDto,
} from './dto/sincronizar.dto.js';
import {
  ListaVisitasRespuestaDto,
  mapearVisita,
  PredioRespuestaDto,
  VisitaRespuestaDto,
} from './dto/visita-respuesta.dto.js';
import { ETIQUETA_TIPO_PREDIO } from './visitas.tipos.js';

/** Resultado de sincronizar un lote de operaciones hechas sin conexión (RF12). */
class RespuestaSincronizacionDto {
  @ApiProperty({ type: [ResultadoSincronizacionDto] })
  resultados: ResultadoSincronizacionDto[];

  @ApiProperty({ type: [VisitaRespuestaDto] })
  visitas: VisitaRespuestaDto[];
}

/**
 * Gestión de visitas (M2 · RF08–RF12).
 *
 * El alcance por rol (el Inspector solo sus visitas, Consulta solo lectura) lo
 * aplica el servicio con el usuario de la sesión, no el cliente (RNF07).
 */
@ApiTags('visitas')
@ApiBearerAuth()
@Controller('visitas')
export class VisitasController {
  constructor(private readonly visitas: VisitasService) {}

  @Get()
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  @ApiOperation({ summary: 'Lista visitas con búsqueda, filtros y conteos' })
  @ApiOkResponse({ type: ListaVisitasRespuestaDto })
  async listar(
    @Query() filtros: ListarVisitasDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<ListaVisitasRespuestaDto> {
    const { datos, total, pagina, porPagina, conteos } =
      await this.visitas.listar(filtros, usuario);
    return {
      datos: datos.map(mapearVisita),
      total,
      pagina,
      porPagina,
      conteos,
    };
  }

  @Get('resumen')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  @ApiOperation({ summary: 'Indicadores del panel principal (RF10)' })
  @ApiOkResponse({ type: ResumenPanelDto })
  resumen(
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<ResumenPanelDto> {
    return this.visitas.resumen(usuario);
  }

  @Get('predios')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  @ApiOperation({ summary: 'Predios registrados, para asociar una visita' })
  @ApiOkResponse({ type: [PredioRespuestaDto] })
  async predios(@Query('busqueda') busqueda?: string) {
    const predios = await this.visitas.listarPredios(busqueda);
    return predios.map((predio) => ({
      id: predio.id,
      nombre: predio.nombre,
      municipio: predio.municipio,
      vereda: predio.vereda,
      tipoPredio: predio.tipoPredio,
      etiquetaTipoPredio: ETIQUETA_TIPO_PREDIO[predio.tipoPredio],
    }));
  }

  @Get('municipios')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  @ApiOperation({
    summary: 'Municipios que ya aparecen en las visitas, para filtrar (RF11)',
  })
  @ApiOkResponse({ type: [String] })
  municipios(): Promise<string[]> {
    return this.visitas.listarMunicipios();
  }

  @Post()
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  @ApiOperation({ summary: 'Programa una visita (RF08)' })
  @ApiOkResponse({ type: VisitaRespuestaDto })
  async crear(
    @Body() dto: CrearVisitaDto,
    @Req() peticion: Request,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<VisitaRespuestaDto> {
    const visita = await this.visitas.crear(dto, usuario, {
      ...contextoDePeticion(peticion),
      actorId: usuario.id,
    });
    return mapearVisita(visita);
  }

  @Post('sincronizar')
  @HttpCode(HttpStatus.OK)
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  @ApiOperation({
    summary: 'Aplica las visitas programadas sin conexión (RF12)',
  })
  @ApiOkResponse({ type: RespuestaSincronizacionDto })
  sincronizar(
    @Body() dto: SincronizarVisitasDto,
    @Req() peticion: Request,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.visitas.sincronizar(dto, usuario, {
      ...contextoDePeticion(peticion),
      actorId: usuario.id,
    });
  }

  @Get(':id')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR, Rol.CONSULTA)
  @ApiOperation({ summary: 'Consulta una visita' })
  @ApiOkResponse({ type: VisitaRespuestaDto })
  async obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<VisitaRespuestaDto> {
    return mapearVisita(await this.visitas.exigirVisita(id, usuario));
  }

  @Patch(':id')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  @ApiOperation({ summary: 'Edita una visita programada (RF08, RF09)' })
  @ApiOkResponse({ type: VisitaRespuestaDto })
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarVisitaDto,
    @Req() peticion: Request,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<VisitaRespuestaDto> {
    const visita = await this.visitas.actualizar(id, dto, usuario, {
      ...contextoDePeticion(peticion),
      actorId: usuario.id,
    });
    return mapearVisita(visita);
  }

  @Patch(':id/estado')
  @Roles(Rol.ADMINISTRADOR, Rol.INSPECTOR)
  @ApiOperation({ summary: 'Cambia el estado de una visita (RF09)' })
  @ApiOkResponse({ type: VisitaRespuestaDto })
  async cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoVisitaDto,
    @Req() peticion: Request,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<VisitaRespuestaDto> {
    const visita = await this.visitas.cambiarEstado(id, dto.estado, usuario, {
      ...contextoDePeticion(peticion),
      actorId: usuario.id,
    });
    return mapearVisita(visita);
  }
}
