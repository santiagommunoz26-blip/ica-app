/**
 * Configuración del frontend para desarrollo.
 * En producción, `environment.production.ts` reemplaza este archivo
 * (ver fileReplacements en angular.json).
 */
export const environment = {
  produccion: false,
  /** URL base de la API (NestJS) con el prefijo de versión. */
  apiUrl: 'http://localhost:3000/api/v1',
};
