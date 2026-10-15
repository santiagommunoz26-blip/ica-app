import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

/** Orígenes permitidos por CORS (separados por comas). */
function origenesPermitidos(): string[] {
  const configurados = process.env.CORS_ORIGENES ?? 'http://localhost:4200';
  return configurados
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
}

/**
 * Configuración común de la aplicación (la usan `main.ts` y las pruebas de
 * integración, para que las pruebas se comporten como producción).
 *
 * - Prefijo `/api/v1` para la API; `/health` queda fuera para que el health
 *   check siga disponible en la ruta corta.
 * - Validación y limpieza de los cuerpos de las peticiones (DTO).
 * - CORS para el frontend de desarrollo.
 */
export function configurarApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  app.useGlobalPipes(
    new ValidationPipe({
      // Elimina propiedades no declaradas en el DTO y rechaza las peticiones
      // con campos desconocidos (evita datos inesperados).
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: origenesPermitidos(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}
