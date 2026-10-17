import {
  calcularVencimiento,
  documentosPendientes,
  prioridadDeMejora,
} from './cierre.reglas.js';
import type { DocumentoEvaluado } from './fase3.tipos.js';

/** Documento de la Fase III mínimo para probar los pendientes (RF31). */
function documento(pendiente: boolean): DocumentoEvaluado {
  return {
    indicadorCodigo: 'MBG-01',
    presentado: false,
    legible: false,
    firmadoResponsable: false,
    firmadoProfesional: null,
    mortalidad: null,
    puntaje: 0,
    pendiente,
    guardadoEn: '2026-10-16T12:00:00.000Z',
  };
}

describe('Reglas del cierre (M7)', () => {
  describe('prioridad de mejora (RF40)', () => {
    it('clasifica por los umbrales del wireframe', () => {
      expect(prioridadDeMejora(58)).toBe('ALTA');
      expect(prioridadDeMejora(59.99)).toBe('ALTA');
      expect(prioridadDeMejora(60)).toBe('MEDIA');
      expect(prioridadDeMejora(75)).toBe('MEDIA');
      expect(prioridadDeMejora(79.99)).toBe('MEDIA');
      expect(prioridadDeMejora(80)).toBe('SIN_PRIORIDAD');
      expect(prioridadDeMejora(100)).toBe('SIN_PRIORIDAD');
    });
  });

  describe('documentos pendientes (RF31, RF43)', () => {
    it('solo cuenta los marcados como pendientes', () => {
      const pendientes = documentosPendientes([
        documento(true),
        documento(false),
        documento(true),
      ]);
      expect(pendientes.length).toBe(2);
    });
  });

  describe('vencimiento del plazo: 1 día hábil a las 5:00 p. m. (RF43)', () => {
    it('un lunes a las 10:00 a. m. vence el martes a las 5:00 p. m.', () => {
      // Lunes 12 oct 2026, 10:00 en Colombia = 15:00 UTC.
      const firma = new Date('2026-10-12T15:00:00Z');
      expect(calcularVencimiento(firma).toISOString()).toBe(
        '2026-10-13T22:00:00.000Z', // martes 17:00 en Colombia.
      );
    });

    it('un viernes vence el lunes (el fin de semana no cuenta)', () => {
      // Viernes 16 oct 2026, 9:00 en Colombia = 14:00 UTC.
      const firma = new Date('2026-10-16T14:00:00Z');
      expect(calcularVencimiento(firma).toISOString()).toBe(
        '2026-10-19T22:00:00.000Z', // lunes 17:00 en Colombia.
      );
    });

    it('un sábado vence el lunes', () => {
      const firma = new Date('2026-10-17T17:00:00Z'); // sábado 12:00.
      expect(calcularVencimiento(firma).toISOString()).toBe(
        '2026-10-19T22:00:00.000Z',
      );
    });

    it('un domingo vence el lunes', () => {
      const firma = new Date('2026-10-18T15:00:00Z'); // domingo 10:00.
      expect(calcularVencimiento(firma).toISOString()).toBe(
        '2026-10-19T22:00:00.000Z',
      );
    });

    it('un viernes a las 11:30 p. m. vence el lunes (no el sábado)', () => {
      const firma = new Date('2026-10-17T04:30:00Z'); // viernes 23:30.
      expect(calcularVencimiento(firma).toISOString()).toBe(
        '2026-10-19T22:00:00.000Z',
      );
    });

    it('un lunes a las 11:00 p. m. vence el martes', () => {
      const firma = new Date('2026-10-13T04:00:00Z'); // lunes 23:00.
      expect(calcularVencimiento(firma).toISOString()).toBe(
        '2026-10-13T22:00:00.000Z',
      );
    });

    it('un jueves vence el viernes', () => {
      // Jueves 15 oct 2026, 3:00 p. m. en Colombia = 20:00 UTC.
      const firma = new Date('2026-10-15T20:00:00Z');
      expect(calcularVencimiento(firma).toISOString()).toBe(
        '2026-10-16T22:00:00.000Z', // viernes 17:00 en Colombia.
      );
    });
  });
});
