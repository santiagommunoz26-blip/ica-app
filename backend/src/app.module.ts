import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PasswordTemporalGuard } from './common/guards/password-temporal.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { buildDatabaseOptions } from './database/database.config.js';
import { HealthModule } from './health/health.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { VisitasModule } from './visitas/visitas.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env de la raíz del monorepo para desarrollo local. En Google Cloud las
      // variables llegan por el entorno del servicio (Cloud Run / Cloud SQL).
      envFilePath: ['../.env', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildDatabaseOptions(config),
    }),
    HealthModule,
    UsuariosModule,
    AuthModule,
    VisitasModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guardas globales, en orden: 1) sesión válida, 2) contraseña temporal ya
    // cambiada (RF07) y 3) rol autorizado (RF04). Cada uno se puede saltar con
    // los decoradores @Publico(), @PermitePasswordTemporal() y @Roles().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordTemporalGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
