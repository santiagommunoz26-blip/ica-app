import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaModulo } from '../common/entities/auditoria-modulo.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { Visita } from '../visitas/entities/visita.entity.js';
import { IndicadorMetodologia } from '../administracion-de-la-metodologia/entities/indicador-metodologia.entity.js';
import { MetodologiaVersion } from '../administracion-de-la-metodologia/entities/metodologia-version.entity.js';
import { PesoGrupo } from '../administracion-de-la-metodologia/entities/peso-grupo.entity.js';
import { ActaVisita } from './entities/acta-visita.entity.js';
import { CierreYReportesFaseIvController } from './cierre-y-reportes-fase-iv.controller.js';
import { CierreYReportesFaseIvService } from './cierre-y-reportes-fase-iv.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActaVisita,
      Visita,
      Usuario,
      MetodologiaVersion,
      IndicadorMetodologia,
      PesoGrupo,
      AuditoriaModulo,
    ]),
  ],
  controllers: [CierreYReportesFaseIvController],
  providers: [CierreYReportesFaseIvService],
})
export class CierreYReportesFaseIvModule {}
