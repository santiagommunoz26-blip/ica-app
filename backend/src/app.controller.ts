import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Publico } from './common/decorators/acceso.decorators.js';
import { AppService } from './app.service.js';

/** Información pública de la API (sirve como comprobación rápida de vida). */
@ApiTags('general')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Publico()
  @Get()
  @ApiOperation({ summary: 'Información de la API' })
  @ApiOkResponse({ description: 'Nombre, versión y ruta de la documentación' })
  getInfo() {
    return this.appService.getInfo();
  }
}
