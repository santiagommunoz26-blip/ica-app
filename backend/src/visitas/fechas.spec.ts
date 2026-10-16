import {
  aFechaEnZona,
  etiquetaMes,
  fechaEnZona,
  mesEnZona,
  sumarMeses,
  ultimosMeses,
} from './fechas.js';

describe('Fechas de las visitas en la hora del país (RF10, RF11)', () => {
  it('una visita de la noche sigue siendo del mismo día en Colombia', () => {
    // 31 de octubre a las 20:00 en Colombia = 1 de noviembre 01:00 UTC.
    const visita = new Date('2026-11-01T01:00:00.000Z');
    expect(fechaEnZona(visita)).toBe('2026-10-31');
    expect(mesEnZona(visita)).toBe('2026-10');
  });

  it('suma meses cruzando el año', () => {
    expect(sumarMeses('2026-01', -1)).toBe('2025-12');
    expect(sumarMeses('2026-11', 2)).toBe('2027-01');
  });

  it('arma los últimos seis meses en orden', () => {
    expect(ultimosMeses(6, '2026-10')).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  it('etiqueta el mes como en el wireframe', () => {
    expect(etiquetaMes('2026-05')).toBe('May');
    expect(etiquetaMes('2026-10')).toBe('Oct');
  });

  it('normaliza lo que llega por la API a una fecha', () => {
    expect(aFechaEnZona('2026-10-31')).toBe('2026-10-31');
    expect(aFechaEnZona('2026-11-01T01:00:00.000Z')).toBe('2026-10-31');
  });
});
