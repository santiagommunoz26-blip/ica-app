import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from './database.config.js';

// Carga el .env de la raíz del monorepo para poder ejecutar las migraciones
// fuera de Nest (npm run migration:run / migration:revert).
config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});

/** Fuente de datos de TypeORM usada por el runner de migraciones. */
export const dataSource = new DataSource(
  buildDatabaseOptions({ get: (name) => process.env[name] }),
);

export default dataSource;
