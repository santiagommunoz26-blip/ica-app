import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModulo } from '../common/entities/auditoria-modulo.entity.js';
import { IndicadorMetodologia } from './entities/indicador-metodologia.entity.js';
import { MetodologiaVersion } from './entities/metodologia-version.entity.js';
import { PesoGrupo } from './entities/peso-grupo.entity.js';
import { AdministracionDeLaMetodologiaController } from './administracion-de-la-metodologia.controller.js';
import { AdministracionDeLaMetodologiaService } from './administracion-de-la-metodologia.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MetodologiaVersion,
      IndicadorMetodologia,
      PesoGrupo,
      AuditoriaModulo,
    ]),
  ],
  controllers: [AdministracionDeLaMetodologiaController],
  providers: [AdministracionDeLaMetodologiaService],
  exports: [AdministracionDeLaMetodologiaService],
})
export class AdministracionDeLaMetodologiaModule {}
