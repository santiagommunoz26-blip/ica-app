import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/configurar-app.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  it('/api/v1 (GET) devuelve la información pública de la API', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect((respuesta) => {
        expect(respuesta.body.aplicacion).toBe('Aplicativo EBA Aves');
        expect(respuesta.body.documentacion).toBe('/api/docs');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
