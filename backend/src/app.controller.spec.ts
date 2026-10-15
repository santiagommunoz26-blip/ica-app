import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('devuelve la información de la API', () => {
      expect(appController.getInfo()).toMatchObject({
        aplicacion: 'Aplicativo EBA Aves',
        documentacion: '/api/docs',
      });
    });
  });
});
