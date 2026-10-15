import { Injectable } from '@nestjs/common';

/** Información pública de la API. */
export interface InfoApi {
  aplicacion: string;
  version: string;
  metodologia: string;
  documentacion: string;
}

@Injectable()
export class AppService {
  getInfo(): InfoApi {
    return {
      aplicacion: 'Aplicativo EBA Aves',
      version: '1.0',
      metodologia: 'ICA v2.0 (2024)',
      documentacion: '/api/docs',
    };
  }
}
