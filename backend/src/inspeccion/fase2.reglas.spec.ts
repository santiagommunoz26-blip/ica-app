import type { Indicador } from '../metodologia/entities/indicador.entity.js';
import {
  GrupoMedidas,
  GrupoProductivo,
  TipoMuestreo,
} from '../metodologia/metodologia.tipos.js';
import { TipoPredio } from '../visitas/visitas.tipos.js';
import {
  avanceDe,
  erroresDeEvaluacion,
  indicadorCompleto,
  promedioPuntos,
  puntoCompleto,
  reglasFase2,
  valorIndicador,
} from './fase2.reglas.js';
import type { EvaluacionFase2, PuntoEvaluado } from './fase2.tipos.js';

/** Indicador de prueba, con los valores del catálogo provisional. */
function indicadorDePrueba(
  codigo: string,
  grupo: GrupoMedidas,
  extra: Partial<Indicador> = {},
): Indicador {
  return {
    id: `id-${codigo}`,
    metodologiaId: 'metodologia-1',
    grupo,
    codigo,
    nombre: `Indicador ${codigo}`,
    metodo: null,
    orden: 0,
    escalaMin: 0,
    escalaMax: 2,
    escalaDescripciones: null,
    tipoMuestreo: TipoMuestreo.PUNTOS_9,
    pregunta: null,
    gruposProductivos: [
      GrupoProductivo.POLLO_ENGORDE,
      GrupoProductivo.PONEDORA_PISO,
      GrupoProductivo.PONEDORA_JAULA,
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  } as Indicador;
}

/** Punto con valores por defecto sensatos para las pruebas. */
function puntoDePrueba(extra: Partial<PuntoEvaluado> = {}): PuntoEvaluado {
  return { numero: 1, puntaje: null, aves: null, jaulas: null, ...extra };
}

/** Evaluación con valores por defecto sensatos para las pruebas. */
function evaluacionDePrueba(
  extra: Partial<EvaluacionFase2> = {},
): EvaluacionFase2 {
  return {
    galponNumero: 1,
    indicadorCodigo: 'MBR-02',
    noAplica: false,
    motivoNoAplica: null,
    observaciones: null,
    puntos: [],
    guardadoEn: '2026-10-16T09:00:00.000Z',
    ...extra,
  };
}

/** Nueve puntos completos en piso, con el puntaje que se pida. */
function puntosPisoCompletos(puntajes: number[]): PuntoEvaluado[] {
  return puntajes.map((puntaje, indice) =>
    puntoDePrueba({ numero: indice + 1, puntaje, aves: 20 }),
  );
}

/** Reglas de prueba: corral con ponedoras en piso. */
const REGLAS_PISO_CORRAL = reglasFase2(
  TipoPredio.CORRAL,
  GrupoProductivo.PONEDORA_PISO,
);
/** Reglas de prueba: corral con ponedoras en jaula. */
const REGLAS_JAULA_CORRAL = reglasFase2(
  TipoPredio.CORRAL,
  GrupoProductivo.PONEDORA_JAULA,
);

describe('Reglas de la Fase II (RF18–RF26)', () => {
  describe('reglas de muestreo (RF18–RF22)', () => {
    it('en piso evalúa 15 a 30 aves por punto, sin jaulas', () => {
      expect(REGLAS_PISO_CORRAL.avesMin).toBe(15);
      expect(REGLAS_PISO_CORRAL.avesMax).toBe(30);
      expect(REGLAS_PISO_CORRAL.jaula).toBe(false);
      expect(REGLAS_PISO_CORRAL.jaulasMin).toBeNull();
      expect(REGLAS_PISO_CORRAL.puntos).toBe(9);
    });

    it('en jaula muestrea 3 a 5 jaulas con 10 a 20 aves por punto', () => {
      expect(REGLAS_JAULA_CORRAL.jaula).toBe(true);
      expect(REGLAS_JAULA_CORRAL.jaulasMin).toBe(3);
      expect(REGLAS_JAULA_CORRAL.jaulasMax).toBe(5);
      expect(REGLAS_JAULA_CORRAL.avesMin).toBe(10);
      expect(REGLAS_JAULA_CORRAL.avesMax).toBe(20);
    });

    it('las hojas centinela piden mínimo 3 en corral y 1 en traspatio (RF22)', () => {
      expect(reglasFase2(TipoPredio.CORRAL, null).hojasCentinelaMinimo).toBe(3);
      expect(reglasFase2(TipoPredio.TRASPATIO, null).hojasCentinelaMinimo).toBe(
        1,
      );
    });
  });

  describe('valor del indicador (RF34)', () => {
    it('promedia solo los puntos calificados', () => {
      const puntos = [
        puntoDePrueba({ puntaje: 2 }),
        puntoDePrueba({ numero: 2, puntaje: 2 }),
        puntoDePrueba({ numero: 3, puntaje: 1 }),
        puntoDePrueba({ numero: 4, puntaje: 1 }),
        puntoDePrueba({ numero: 5 }),
      ];
      expect(promedioPuntos(puntos)).toBe(1.5);
      expect(valorIndicador(1.5)).toBe(75);
    });

    it('sin puntos calificados no hay promedio ni valor', () => {
      expect(promedioPuntos([puntoDePrueba()])).toBeNull();
      expect(promedioPuntos([])).toBeNull();
      expect(valorIndicador(null)).toBeNull();
    });

    it('calcula el ejemplo del wireframe: promedio 1,5 → 75 %', () => {
      expect(
        valorIndicador(promedioPuntos(puntosPisoCompletos([2, 2, 1, 1]))),
      ).toBe(75);
    });
  });

  describe('completitud de puntos e indicadores (RF19–RF21, RF24)', () => {
    it('un punto en piso está completo con puntaje y aves dentro del rango', () => {
      expect(
        puntoCompleto(
          puntoDePrueba({ puntaje: 2, aves: 20 }),
          REGLAS_PISO_CORRAL,
        ),
      ).toBe(true);
      expect(
        puntoCompleto(
          puntoDePrueba({ puntaje: 2, aves: 10 }),
          REGLAS_PISO_CORRAL,
        ),
      ).toBe(false);
      expect(
        puntoCompleto(
          puntoDePrueba({ puntaje: null, aves: 20 }),
          REGLAS_PISO_CORRAL,
        ),
      ).toBe(false);
      expect(
        puntoCompleto(puntoDePrueba({ puntaje: 2 }), REGLAS_PISO_CORRAL),
      ).toBe(false);
    });

    it('un punto en jaula exige jaulas y total de aves antes de calificar (RF21)', () => {
      expect(
        puntoCompleto(
          puntoDePrueba({ puntaje: 1, jaulas: 4, aves: 15 }),
          REGLAS_JAULA_CORRAL,
        ),
      ).toBe(true);
      expect(
        puntoCompleto(
          puntoDePrueba({ puntaje: 1, jaulas: 4 }),
          REGLAS_JAULA_CORRAL,
        ),
      ).toBe(false);
      expect(
        puntoCompleto(
          puntoDePrueba({ puntaje: 1, jaulas: 2, aves: 15 }),
          REGLAS_JAULA_CORRAL,
        ),
      ).toBe(false);
    });

    it('un indicador de 9 puntos está completo cuando todos lo están', () => {
      const indicador = indicadorDePrueba('MBR-02', GrupoMedidas.MBR);
      expect(
        indicadorCompleto(
          evaluacionDePrueba({
            puntos: puntosPisoCompletos([2, 2, 1, 1, 0, 1, 2, 2, 1]),
          }),
          indicador,
          REGLAS_PISO_CORRAL,
        ),
      ).toBe(true);
      expect(
        indicadorCompleto(
          evaluacionDePrueba({
            puntos: puntosPisoCompletos([2, 2, 1, 1, 0, 1, 2, 2]),
          }),
          indicador,
          REGLAS_PISO_CORRAL,
        ),
      ).toBe(false);
      // Sin evaluación guardada no está completo.
      expect(indicadorCompleto(undefined, indicador, REGLAS_PISO_CORRAL)).toBe(
        false,
      );
    });

    it('«No aplica» completa el indicador solo con motivo (RF25)', () => {
      const indicador = indicadorDePrueba('MBR-02', GrupoMedidas.MBR);
      expect(
        indicadorCompleto(
          evaluacionDePrueba({
            noAplica: true,
            motivoNoAplica: 'No hay nidal',
          }),
          indicador,
          REGLAS_PISO_CORRAL,
        ),
      ).toBe(true);
      expect(
        indicadorCompleto(
          evaluacionDePrueba({ noAplica: true, motivoNoAplica: '  ' }),
          indicador,
          REGLAS_PISO_CORRAL,
        ),
      ).toBe(false);
    });

    it('las hojas centinela completan con el mínimo del predio (RF22)', () => {
      const indicador = indicadorDePrueba('MBR-01', GrupoMedidas.MBR, {
        tipoMuestreo: TipoMuestreo.HOJAS_CENTINELA,
      });
      const tresHojas = [1, 2, 3].map((numero) =>
        puntoDePrueba({ numero, puntaje: 2, aves: 20 }),
      );
      expect(
        indicadorCompleto(
          evaluacionDePrueba({ puntos: tresHojas }),
          indicador,
          REGLAS_PISO_CORRAL,
        ),
      ).toBe(true);
      expect(
        indicadorCompleto(
          evaluacionDePrueba({ puntos: tresHojas.slice(0, 2) }),
          indicador,
          REGLAS_PISO_CORRAL,
        ),
      ).toBe(false);
      expect(
        indicadorCompleto(
          evaluacionDePrueba({ puntos: tresHojas.slice(0, 1) }),
          indicador,
          reglasFase2(TipoPredio.TRASPATIO, GrupoProductivo.PONEDORA_PISO),
        ),
      ).toBe(true);
    });
  });

  describe('validación al guardar (RF19–RF21)', () => {
    it('rechaza puntajes fuera de 0, 1 o 2', () => {
      const indicador = indicadorDePrueba('MBR-02', GrupoMedidas.MBR);
      const errores = erroresDeEvaluacion(
        evaluacionDePrueba({
          puntos: [puntoDePrueba({ puntaje: 3, aves: 20 })],
        }),
        indicador,
        REGLAS_PISO_CORRAL,
      );
      expect(errores.length).toBe(1);
      expect(errores[0]).toContain('puntaje debe ser 0, 1 o 2');
    });

    it('rechaza muestras fuera del rango de piso (RF20)', () => {
      const indicador = indicadorDePrueba('MBR-02', GrupoMedidas.MBR);
      const errores = erroresDeEvaluacion(
        evaluacionDePrueba({
          puntos: [puntoDePrueba({ puntaje: 2, aves: 10 })],
        }),
        indicador,
        REGLAS_PISO_CORRAL,
      );
      expect(errores.length).toBe(1);
      expect(errores[0]).toContain('entre 15 y 30 aves');
    });

    it('rechaza calificar jaulas sin contar aves primero (RF21)', () => {
      const indicador = indicadorDePrueba('MBR-02', GrupoMedidas.MBR);
      const errores = erroresDeEvaluacion(
        evaluacionDePrueba({
          puntos: [puntoDePrueba({ puntaje: 1, jaulas: 4 })],
        }),
        indicador,
        REGLAS_JAULA_CORRAL,
      );
      expect(errores.length).toBe(1);
      expect(errores[0]).toContain('antes de calificar');
    });

    it('rechaza puntos repetidos', () => {
      const indicador = indicadorDePrueba('MBR-02', GrupoMedidas.MBR);
      const errores = erroresDeEvaluacion(
        evaluacionDePrueba({
          puntos: [
            puntoDePrueba({ numero: 1, puntaje: 2, aves: 20 }),
            puntoDePrueba({ numero: 1, puntaje: 1, aves: 20 }),
          ],
        }),
        indicador,
        REGLAS_PISO_CORRAL,
      );
      expect(errores.length).toBe(1);
      expect(errores[0]).toContain('repetido');
    });

    it('rechaza «No aplica» sin motivo (RF25)', () => {
      const indicador = indicadorDePrueba('MBR-02', GrupoMedidas.MBR);
      const errores = erroresDeEvaluacion(
        evaluacionDePrueba({ noAplica: true, motivoNoAplica: 'x' }),
        indicador,
        REGLAS_PISO_CORRAL,
      );
      expect(errores.length).toBe(1);
      expect(errores[0]).toContain('motivo');
    });

    it('acepta un borrador a medio llenar (RF26)', () => {
      const indicador = indicadorDePrueba('MBR-02', GrupoMedidas.MBR);
      const errores = erroresDeEvaluacion(
        evaluacionDePrueba({
          puntos: [puntoDePrueba({ numero: 1, puntaje: 2, aves: 20 })],
        }),
        indicador,
        REGLAS_PISO_CORRAL,
      );
      expect(errores).toEqual([]);
    });
  });

  describe('avance por galpón y grupo (RF24)', () => {
    it('cuenta los indicadores completos de cada grupo', () => {
      const indicadores = [
        indicadorDePrueba('MBR-01', GrupoMedidas.MBR, {
          tipoMuestreo: TipoMuestreo.HOJAS_CENTINELA,
        }),
        indicadorDePrueba('MBR-02', GrupoMedidas.MBR),
        indicadorDePrueba('MBA-01', GrupoMedidas.MBA),
      ];
      const evaluaciones = [
        evaluacionDePrueba({
          indicadorCodigo: 'MBR-01',
          puntos: [1, 2, 3].map((numero) =>
            puntoDePrueba({ numero, puntaje: 2, aves: 20 }),
          ),
        }),
        evaluacionDePrueba({
          indicadorCodigo: 'MBR-02',
          puntos: puntosPisoCompletos([2, 2, 1, 1, 0, 1, 2, 2, 1]),
        }),
      ];

      const avance = avanceDe(
        [1, 2],
        indicadores,
        evaluaciones,
        REGLAS_PISO_CORRAL,
      );
      expect(avance.length).toBe(2);
      expect(avance[0].grupos).toEqual([
        {
          grupo: GrupoMedidas.MBA,
          etiqueta: 'Animal (MBA)',
          completos: 0,
          total: 1,
        },
        {
          grupo: GrupoMedidas.MBR,
          etiqueta: 'Recursos (MBR)',
          completos: 2,
          total: 2,
        },
      ]);
      expect(avance[1].grupos[1].completos).toBe(0);
    });
  });
});
