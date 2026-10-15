import { dataSource } from './data-source.js';

/**
 * Runner de migraciones del proyecto.
 *
 * Uso (siempre sobre el código compilado, ver scripts de package.json):
 *   npm run migration:run      -> aplica las migraciones pendientes
 *   npm run migration:revert   -> revierte la última migración aplicada
 */
async function main(): Promise<void> {
  const command = process.argv[2] ?? 'run';

  await dataSource.initialize();

  switch (command) {
    case 'run': {
      const applied = await dataSource.runMigrations({ transaction: 'each' });
      if (applied.length === 0) {
        console.log('No hay migraciones pendientes.');
        break;
      }
      for (const migration of applied) {
        console.log(`Migración aplicada: ${migration.name}`);
      }
      break;
    }
    case 'revert': {
      await dataSource.undoLastMigration({ transaction: 'each' });
      console.log(
        'Se revirtió la última migración aplicada (si había alguna).',
      );
      break;
    }
    default:
      throw new Error(
        `Comando no reconocido: "${command}" (usa "run" o "revert").`,
      );
  }
}

try {
  await main();
} catch (error) {
  console.error(
    `Error al ejecutar las migraciones: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
} finally {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}
