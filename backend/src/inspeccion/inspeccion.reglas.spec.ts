import {
  clasificarPorAves,
  galponesSugeridos,
  numerosSugeridos,
  priorizarPorEdad,
} from './inspeccion.reglas.js';
import { TipoPredio } from '../visitas/visitas.tipos.js';

/** Reglas de la Fase I (M3 · RF14, RF16). */
describe('Reglas de la Fase I (RF14, RF16)', () => {
  describe('clasificación automática del predio (RF14)', () => {
    it('clasifica como granja (corral) desde 200 aves', () => {
      expect(clasificarPorAves(200)).toBe(TipoPredio.CORRAL);
      expect(clasificarPorAves(62000)).toBe(TipoPredio.CORRAL);
    });

    it('clasifica como traspatio con 199 aves o menos', () => {
      expect(clasificarPorAves(199)).toBe(TipoPredio.TRASPATIO);
      expect(clasificarPorAves(0)).toBe(TipoPredio.TRASPATIO);
    });
  });

  describe('sugerencia de galpones (RF16)', () => {
    it('sugiere un galpón por debajo de 50.000 aves', () => {
      expect(galponesSugeridos(49999)).toBe(1);
      expect(galponesSugeridos(199)).toBe(1);
    });

    it('sugiere dos galpones desde 50.000 aves', () => {
      expect(galponesSugeridos(50000)).toBe(2);
      expect(galponesSugeridos(62000)).toBe(2);
    });

    it('prioriza los galpones con las aves de mayor edad', () => {
      const galpones = [
        { numero: 1, edadSemanas: 18 },
        { numero: 2, edadSemanas: 62 },
        { numero: 3, edadSemanas: 40 },
      ];
      expect(numerosSugeridos(galpones, 62000)).toEqual([2, 3]);
      expect(numerosSugeridos(galpones, 10000)).toEqual([2]);
    });

    it('deja al final los galpones sin edad registrada', () => {
      const galpones = [
        { numero: 1, edadSemanas: null },
        { numero: 2, edadSemanas: 5 },
      ];
      expect(priorizarPorEdad(galpones, 2)).toEqual([
        { numero: 2, edadSemanas: 5 },
        { numero: 1, edadSemanas: null },
      ]);
    });
  });
});
