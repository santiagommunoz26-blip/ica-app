import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { AppMetadata } from './entities/app-metadata.entity.js';
import { RegistroAcceso } from '../usuarios/entities/registro-acceso.entity.js';
import { Sesion } from '../usuarios/entities/sesion.entity.js';
import { TokenPassword } from '../usuarios/entities/token-password.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { Predio } from '../visitas/entities/predio.entity.js';
import { Visita } from '../visitas/entities/visita.entity.js';
import { Indicador } from '../metodologia/entities/indicador.entity.js';
import { Metodologia } from '../metodologia/entities/metodologia.entity.js';
import { PesoGrupo } from '../metodologia/entities/peso-grupo.entity.js';
import { Galpon } from '../inspeccion/entities/galpon.entity.js';
import { Inspeccion } from '../inspeccion/entities/inspeccion.entity.js';

/** Lector de variables de entorno (compatible con process.env y ConfigService). */
export interface EnvReader {
  get(name: string): string | undefined;
}

/**
 * Construye las opciones de conexión a PostgreSQL.
 *
 * Los valores por defecto coinciden con docker-compose.yml y son solo para
 * desarrollo local. En producción (Cloud SQL) se sobrescriben mediante
 * variables de entorno, sin tocar el código.
 *
 * Importante: las tablas se crean SIEMPRE con migraciones (synchronize = false).
 * Pendiente para el despliegue (M8): añadir soporte de SSL/Cloud SQL.
 */
export function buildDatabaseOptions(env: EnvReader): DataSourceOptions {
  const read = (name: string, fallback: string): string =>
    env.get(name) ?? fallback;

  return {
    type: 'postgres',
    host: read('POSTGRES_HOST', 'localhost'),
    port: Number(read('POSTGRES_PORT', '5432')),
    username: read('POSTGRES_USER', 'ica'),
    password: read('POSTGRES_PASSWORD', 'ica'),
    database: read('POSTGRES_DB', 'ica'),
    synchronize: false,
    entities: [
      AppMetadata,
      Usuario,
      Sesion,
      TokenPassword,
      RegistroAcceso,
      Predio,
      Visita,
      Metodologia,
      Indicador,
      PesoGrupo,
      Inspeccion,
      Galpon,
    ],
    // Al ejecutarse compilado, este archivo vive en dist/database, así que el
    // patrón apunta a las migraciones compiladas en dist/database/migrations.
    migrations: [join(import.meta.dirname, 'migrations/*.js')],
    migrationsTableName: 'migrations',
    logging:
      env.get('TYPEORM_LOGGING') === 'true' ? ['query', 'error'] : ['error'],
  };
}
