import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetodologiaModule } from '../metodologia/metodologia.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { Predio } from '../visitas/entities/predio.entity.js';
import { Visita } from '../visitas/entities/visita.entity.js';
import { Galpon } from './entities/galpon.entity.js';
import { Inspeccion } from './entities/inspeccion.entity.js';
import { InspeccionController } from './inspeccion.controller.js';
import { InspeccionService } from './inspeccion.service.js';

/**
 * Apertura y ficha general, Fase I (M3 · RF13–RF17).
 *
 * Importa MetodologiaModule para leer el catálogo (pesos e indicadores) y
 * UsuariosModule para la bitácora (RNF11). Registra también Visita y Predio
 * porque la ficha vive en el predio y la inspección se identifica por la visita;
 * no importa VisitasModule para no crear una dependencia circular (VisitasModule
 * sí importa este módulo, para sincronizar la ficha sin conexión).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Inspeccion, Galpon, Visita, Predio]),
    MetodologiaModule,
    UsuariosModule,
  ],
  controllers: [InspeccionController],
  providers: [InspeccionService],
  exports: [InspeccionService],
})
export class InspeccionModule {}
