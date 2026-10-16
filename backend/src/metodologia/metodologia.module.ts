import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Indicador } from './entities/indicador.entity.js';
import { Metodologia } from './entities/metodologia.entity.js';
import { PesoGrupo } from './entities/peso-grupo.entity.js';
import { MetodologiaService } from './metodologia.service.js';

/**
 * Catálogo de la metodología (M3 · RF14–RF17; su administración es M8).
 *
 * Por ahora solo lee la versión activa; M8 añadirá el controlador de
 * administración (RF46–RF49) sobre las mismas entidades.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Metodologia, Indicador, PesoGrupo])],
  providers: [MetodologiaService],
  exports: [MetodologiaService, TypeOrmModule],
})
export class MetodologiaModule {}
