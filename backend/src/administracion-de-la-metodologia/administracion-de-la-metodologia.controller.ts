import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { Roles } from '../common/decorators/acceso.decorators.js';
import { Rol } from '../common/roles.js';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado.interface.js';
import { GuardarIndicadorDto } from './dto/guardar-indicador.dto.js';
import { GuardarPesosDto } from './dto/guardar-pesos.dto.js';
import { AdministracionDeLaMetodologiaService } from './administracion-de-la-metodologia.service.js';

@Controller('modulo8')
@Roles(Rol.ADMINISTRADOR)
export class AdministracionDeLaMetodologiaController {
  constructor(private readonly metodologia: AdministracionDeLaMetodologiaService) {}

  @Get('versiones')
  listarVersiones() {
    return this.metodologia.listarVersiones();
  }

  @Get('auditoria')
  listarAuditoria() {
    return this.metodologia.listarAuditoria();
  }

  @Get('catalogo')
  obtenerCatalogo() {
    return this.metodologia.obtenerCatalogo();
  }

  @Post('indicadores')
  crearIndicador(
    @Body() dto: GuardarIndicadorDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.metodologia.crearIndicador(dto, usuario.id);
  }

  @Patch('indicadores/:id')
  actualizarIndicador(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GuardarIndicadorDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.metodologia.actualizarIndicador(id, dto, usuario.id);
  }

  @Put('pesos')
  actualizarPesos(
    @Body() dto: GuardarPesosDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.metodologia.actualizarPesos(dto, usuario.id);
  }

  @Post('versiones/:id/activar')
  activarVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.metodologia.activarVersion(id, usuario.id);
  }
}
