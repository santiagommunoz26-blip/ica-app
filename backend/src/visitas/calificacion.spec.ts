import { clasificar } from './calificacion.js';
import { Clasificacion } from './visitas.tipos.js';

describe('Clasificación del puntaje (RF21, RF36)', () => {
  it('90 o más es Excelente', () => {
    expect(clasificar(90)).toBe(Clasificacion.EXCELENTE);
    expect(clasificar(100)).toBe(Clasificacion.EXCELENTE);
  });

  it('entre 75 y menos de 90 es Alto', () => {
    expect(clasificar(75)).toBe(Clasificacion.ALTO);
    expect(clasificar(89.9)).toBe(Clasificacion.ALTO);
  });

  it('entre 50 y menos de 75 es Medio', () => {
    expect(clasificar(50)).toBe(Clasificacion.MEDIO);
    expect(clasificar(74.9)).toBe(Clasificacion.MEDIO);
  });

  it('menos de 50 es Bajo', () => {
    expect(clasificar(49.9)).toBe(Clasificacion.BAJO);
    expect(clasificar(0)).toBe(Clasificacion.BAJO);
  });
});
