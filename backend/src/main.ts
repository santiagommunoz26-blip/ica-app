import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configurarApp } from './configurar-app.js';

/** Documentación interactiva de la API (ADR-004: REST + OpenAPI). */
function montarDocumentacion(app: Parameters<typeof configurarApp>[0]): void {
  const configuracion = new DocumentBuilder()
    .setTitle('API · Aplicativo EBA Aves')
    .setDescription(
      'API REST del Aplicativo EBA Aves (metodología ICA v2.0, 2024). ' +
        'Las rutas protegidas requieren el token de acceso en el encabezado Authorization.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documento = SwaggerModule.createDocument(app, configuracion);
  SwaggerModule.setup('api/docs', app, documento, {
    swaggerOptions: { persistAuthorization: true },
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Cierra limpiamente las conexiones (por ejemplo TypeORM) al recibir señales.
  app.enableShutdownHooks();

  configurarApp(app);
  montarDocumentacion(app);

  const puerto = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 3000);
  await app.listen(puerto);

  new Logger('Bootstrap').log(
    `API escuchando en http://localhost:${puerto} (documentación en /api/docs)`,
  );
}
await bootstrap();
