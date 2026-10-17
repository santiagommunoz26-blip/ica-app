import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { MetodologiaModule } from '../metodologia/metodologia.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { Predio } from '../visitas/entities/predio.entity.js';
import { Visita } from '../visitas/entities/visita.entity.js';
import { ActaPdfService } from './acta-pdf.service.js';
import { ActasService } from './actas.service.js';
import { AlmacenamientoService } from './almacenamiento.service.js';
import { Acta } from './entities/acta.entity.js';
import { Evidencia } from './entities/evidencia.entity.js';
import { Galpon } from './entities/galpon.entity.js';
import { Inspeccion } from './entities/inspeccion.entity.js';
import { EvidenciasService } from './evidencias.service.js';
import { InspeccionController } from './inspeccion.controller.js';
import { InspeccionService } from './inspeccion.service.js';

/**
 * Apertura y ficha general (Fase I, M3 · RF13–RF17), inspección en galpón
 * (Fase II, M4 · RF18–RF26) y cierre y actas (Fase IV, M7 · RF39–RF45).
 *
 * Importa MetodologiaModule para leer el catálogo (pesos, indicadores y sus
 * muestreos), UsuariosModule para la bitácora (RNF11) y AuthModule por el
 * transporte de correo del acta (RF45). Registra también Visita y Predio
 * porque la ficha vive en el predio y la inspección se identifica por la
 * visita; no importa VisitasModule para no crear una dependencia circular
 * (VisitasModule sí importa este módulo, para sincronizar la ficha sin
 * conexión).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Inspeccion,
      Galpon,
      Evidencia,
      Acta,
      Visita,
      Predio,
    ]),
    MetodologiaModule,
    UsuariosModule,
    AuthModule,
  ],
  controllers: [InspeccionController],
  providers: [
    InspeccionService,
    EvidenciasService,
    AlmacenamientoService,
    ActaPdfService,
    ActasService,
  ],
  exports: [InspeccionService, ActasService],
})
export class InspeccionModule {}
