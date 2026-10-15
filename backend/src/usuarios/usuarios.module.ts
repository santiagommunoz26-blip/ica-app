import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './entities/usuario.entity.js';
import { RegistroAcceso } from './entities/registro-acceso.entity.js';
import { UsuariosService } from './usuarios.service.js';
import { UsuariosController } from './usuarios.controller.js';
import { RolesController } from './roles.controller.js';
import { RegistroAccesoService } from './registro-acceso.service.js';

/**
 * Módulo de usuarios (M1 · RF04, RF05) y bitácora de auditoría (RNF11).
 * RegistroAccesoService se exporta porque la autenticación también audita.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Usuario, RegistroAcceso])],
  controllers: [UsuariosController, RolesController],
  providers: [UsuariosService, RegistroAccesoService],
  exports: [UsuariosService, RegistroAccesoService],
})
export class UsuariosModule {}
