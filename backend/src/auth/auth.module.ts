import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sesion } from '../usuarios/entities/sesion.entity.js';
import { TokenPassword } from '../usuarios/entities/token-password.entity.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { secretoJwt } from '../common/configuracion.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CorreoService } from './correo.service.js';
import { JwtStrategy } from './estrategias/jwt.strategy.js';
import { SesionesService } from './sesiones.service.js';
import { TokensPasswordService } from './tokens-password.service.js';

/** Módulo de autenticación (M1 · RF01–RF03, RF06, RF07). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Sesion, TokenPassword]),
    UsuariosModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // El secreto sale del entorno (RNFG06); en desarrollo, si falta, se
        // genera uno temporal y se avisa (ver common/configuracion.ts).
        secret: secretoJwt(config),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SesionesService,
    TokensPasswordService,
    CorreoService,
    JwtStrategy,
  ],
  exports: [AuthService, CorreoService],
})
export class AuthModule {}
