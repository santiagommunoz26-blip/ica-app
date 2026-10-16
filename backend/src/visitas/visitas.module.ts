import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { Predio } from './entities/predio.entity.js';
import { Visita } from './entities/visita.entity.js';
import { VisitasController } from './visitas.controller.js';
import { VisitasService } from './visitas.service.js';

/**
 * Módulo de gestión de visitas (M2 · RF08–RF12).
 *
 * Importa UsuariosModule para reutilizar la bitácora de auditoría (RNF11) con
 * la que se registran las visitas creadas, editadas y sincronizadas.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Visita, Predio, Usuario]),
    UsuariosModule,
  ],
  controllers: [VisitasController],
  providers: [VisitasService],
  exports: [VisitasService],
})
export class VisitasModule {}
