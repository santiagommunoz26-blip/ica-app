import type { Indicador } from '../metodologia/entities/indicador.entity.js';
import type { PesoGrupo } from '../metodologia/entities/peso-grupo.entity.js';
import {
  GrupoMedidas,
  GrupoProductivo,
  TipoEvaluacion,
  TipoMuestreo,
  type RangoEscala,
} from '../metodologia/metodologia.tipos.js';
import { Clasificacion, TipoPredio } from '../visitas/visitas.tipos.js';
import { reglasFase2 } from './fase2.reglas.js';
import type { EvaluacionFase2, PuntoEvaluado } from './fase2.tipos.js';
import type { DocumentoEvaluado } from './fase3.tipos.js';
import {
  calcularVisita,
  puntajePorRangos,
  rangosDe,
  resultadoPara,
} from './calculo.reglas.js';
import type { EntradaCalculo } from './calculo.tipos.js';

/**
 * Pruebas del motor de cálculo (M6 · RF34–RF38).
 *
 * Los ejemplos numéricos están verificados a mano contra las fórmulas de la
 * metodología y contra el motor del spike (`docs/spike-form-engine/`): con
 * MBA 79,17, MBR 50,00 y MBG 100,00 (pesos 35/35/30) el final es 75,21 y la
 * clasificación Alto (RNF03).
 */

const GRUPOS = [
  GrupoProductivo.POLLO_ENGORDE,
  GrupoProductivo.PONEDORA_PISO,
  GrupoProductivo.PONEDORA_JAULA,
];

/** Indicador de prueba con los valores del catálogo provisional. */
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
    tipoEvaluacion: TipoEvaluacion.PUNTAJE,
    escalaRangos: null,
    exigeFirmaProfesional: false,
    gruposProductivos: GRUPOS,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  } as Indicador;
}

/** Peso de prueba del catálogo (el peso llega como texto de la base). */
function pesoDePrueba(
  perfil: TipoPredio,
  grupo: GrupoMedidas,
  peso: number,
): PesoGrupo {
  return {
    id: `peso-${perfil}-${grupo}`,
    metodologiaId: 'metodologia-1',
    perfil,
    grupo,
    peso: peso.toFixed(2),
  } as PesoGrupo;
}

/** Los pesos de la metodología: corral 35/35/30; traspatio 60/40 (RF14). */
const PESOS: PesoGrupo[] = [
  pesoDePrueba(TipoPredio.CORRAL, GrupoMedidas.MBA, 35),
  pesoDePrueba(TipoPredio.CORRAL, GrupoMedidas.MBR, 35),
  pesoDePrueba(TipoPredio.CORRAL, GrupoMedidas.MBG, 30),
  pesoDePrueba(TipoPredio.TRASPATIO, GrupoMedidas.MBA, 60),
  pesoDePrueba(TipoPredio.TRASPATIO, GrupoMedidas.MBR, 40),
];

/** Puntos de muestreo con muestra válida en piso (15–30 aves, RF20). */
function puntosDe(puntajes: (number | null)[]): PuntoEvaluado[] {
  return puntajes.map((puntaje, indice) => ({
    numero: indice + 1,
    puntaje,
    aves: puntaje === null ? null : 20,
    jaulas: null,
  }));
}

/** Evaluación de prueba de la Fase II. */
function evaluacionDePrueba(
  galponNumero: number,
  indicadorCodigo: string,
  puntajes: (number | null)[],
  extra: Partial<EvaluacionFase2> = {},
): EvaluacionFase2 {
  return {
    galponNumero,
    indicadorCodigo,
    noAplica: false,
    motivoNoAplica: null,
    observaciones: null,
    puntos: puntosDe(puntajes),
    guardadoEn: '2026-10-16T09:00:00.000Z',
    ...extra,
  };
}

/** Documento de gestión de prueba (Fase III). */
function documentoDePrueba(
  indicadorCodigo: string,
  puntaje: number | null,
  extra: Partial<DocumentoEvaluado> = {},
): DocumentoEvaluado {
  return {
    indicadorCodigo,
    presentado: puntaje === null ? null : true,
    legible: true,
    firmadoResponsable: true,
    firmadoProfesional: null,
    mortalidad: null,
    puntaje,
    pendiente: false,
    guardadoEn: '2026-10-16T09:00:00.000Z',
    ...extra,
  };
}

/** Entrada del motor con valores por defecto de corral. */
function entradaDePrueba(extra: Partial<EntradaCalculo> = {}): EntradaCalculo {
  const grupoProductivo =
    extra.grupoProductivo ?? GrupoProductivo.POLLO_ENGORDE;
  return {
    indicadores: [],
    grupoProductivo,
    tipoPredio: TipoPredio.CORRAL,
    pesos: PESOS,
    galpones: [1],
    evaluaciones: [],
    documentos: [],
    fase3Aplica: true,
    reglasFase2: reglasFase2(TipoPredio.CORRAL, grupoProductivo),
    ...extra,
  };
}

describe('Motor de cálculo (RF34–RF38)', () => {
  describe('valor del indicador (RF34)', () => {
    it('promedio de puntajes × 100 / escala máxima', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBA-01', GrupoMedidas.MBA)],
          evaluaciones: [evaluacionDePrueba(1, 'MBA-01', [2, 2, 1, 1])],
        }),
      );
      const indicador = resultado.indicadores[0];
      expect(indicador.valor).toBe(75);
      expect(indicador.galpones).toEqual([
        { galponNumero: 1, valor: 75, noAplica: false, completo: false },
      ]);
    });

    it('con varios galpones, el valor es el promedio de los galpones', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBA-01', GrupoMedidas.MBA)],
          galpones: [1, 2],
          evaluaciones: [
            evaluacionDePrueba(1, 'MBA-01', [2, 2]),
            evaluacionDePrueba(2, 'MBA-01', [1, 1]),
          ],
        }),
      );
      const indicador = resultado.indicadores[0];
      expect(indicador.valor).toBe(75);
      expect(indicador.galpones.map((galpon) => galpon.valor)).toEqual([
        100, 50,
      ]);
    });

    it('un galpón sin puntos calificados no aporta al promedio', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBA-01', GrupoMedidas.MBA)],
          galpones: [1, 2],
          evaluaciones: [
            evaluacionDePrueba(1, 'MBA-01', [2, 2]),
            evaluacionDePrueba(2, 'MBA-01', [null, null]),
          ],
        }),
      );
      expect(resultado.indicadores[0].valor).toBe(100);
    });

    it('un indicador sin ninguna evaluación queda sin valor', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBA-01', GrupoMedidas.MBA)],
        }),
      );
      expect(resultado.indicadores[0].valor).toBeNull();
      expect(resultado.indicadores[0].completo).toBe(false);
    });

    it('el valor de los indicadores de gestión sale del puntaje del documento (RF34)', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBG-01', GrupoMedidas.MBG)],
          documentos: [documentoDePrueba('MBG-01', 1)],
        }),
      );
      expect(resultado.indicadores[0].valor).toBe(50);
      expect(resultado.indicadores[0].galpones).toEqual([]);
    });
  });

  describe('grupos, final y clasificación (RF35, RF36)', () => {
    it('el ejemplo verificado: 75,21 y clasificación Alto (RNF03)', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [
            indicadorDePrueba('MBA-01', GrupoMedidas.MBA),
            indicadorDePrueba('MBA-02', GrupoMedidas.MBA),
            indicadorDePrueba('MBR-01', GrupoMedidas.MBR),
            indicadorDePrueba('MBG-01', GrupoMedidas.MBG),
          ],
          evaluaciones: [
            // MBA-01: promedio 1,5 → 75; MBA-02: promedio 1,666… → 83,33.
            evaluacionDePrueba(1, 'MBA-01', [1, 2]),
            evaluacionDePrueba(1, 'MBA-02', [2, 1, 2]),
            // MBR-01: promedio 1 → 50.
            evaluacionDePrueba(1, 'MBR-01', [1, 1]),
          ],
          documentos: [documentoDePrueba('MBG-01', 2)],
        }),
      );

      const mba = resultado.grupos.find((grupo) => grupo.grupo === 'MBA');
      const mbr = resultado.grupos.find((grupo) => grupo.grupo === 'MBR');
      const mbg = resultado.grupos.find((grupo) => grupo.grupo === 'MBG');
      expect(mba?.promedio).toBe(79.17);
      expect(mba?.aporte).toBe(27.71);
      expect(mbr?.promedio).toBe(50);
      expect(mbr?.aporte).toBe(17.5);
      expect(mbg?.promedio).toBe(100);
      expect(mbg?.aporte).toBe(30);
      expect(resultado.final).toBe(75.21);
      expect(resultado.clasificacion).toBe(Clasificacion.ALTO);
    });

    it('el final es la suma con precisión completa, redondeada al final (RNF03)', () => {
      // Dos grupos con promedio 33,333…: 33,3333 × 35 % = 11,6666…
      // Suma exacta 23,3333… → 23,33; redondear cada aporte daría 23,34.
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [
            indicadorDePrueba('MBA-01', GrupoMedidas.MBA),
            indicadorDePrueba('MBR-01', GrupoMedidas.MBR),
          ],
          evaluaciones: [
            evaluacionDePrueba(1, 'MBA-01', [0, 1, 1]),
            evaluacionDePrueba(1, 'MBR-01', [0, 1, 1]),
          ],
        }),
      );
      const mba = resultado.grupos.find((grupo) => grupo.grupo === 'MBA');
      expect(mba?.promedio).toBe(33.33);
      expect(mba?.aporte).toBe(11.67);
      expect(resultado.final).toBe(23.33);
    });

    it('la clasificación del final es la de la metodología (RF36)', () => {
      // Con MBA al 100 % el final es el valor del indicador, para leer los
      // niveles con puntajes sencillos (los cortes exactos están en
      // `calificacion.spec.ts`).
      const clasificacionDe = (puntajes: (number | null)[]) =>
        calcularVisita(
          entradaDePrueba({
            indicadores: [indicadorDePrueba('MBA-01', GrupoMedidas.MBA)],
            evaluaciones: [evaluacionDePrueba(1, 'MBA-01', puntajes)],
            pesos: [pesoDePrueba(TipoPredio.CORRAL, GrupoMedidas.MBA, 100)],
          }),
        );

      expect(clasificacionDe([2, 2]).final).toBe(100);
      expect(clasificacionDe([2, 2]).clasificacion).toBe(
        Clasificacion.EXCELENTE,
      );
      // 90: promedio 1,8.
      expect(clasificacionDe([2, 2, 2, 2, 1]).clasificacion).toBe(
        Clasificacion.EXCELENTE,
      );
      // 75: promedio 1,5.
      expect(clasificacionDe([2, 1]).clasificacion).toBe(Clasificacion.ALTO);
      // 70: promedio 1,4.
      expect(clasificacionDe([2, 2, 1, 1, 1]).clasificacion).toBe(
        Clasificacion.MEDIO,
      );
      // 45: promedio 0,9.
      expect(
        clasificacionDe([1, 1, 1, 1, 1, 1, 1, 1, 1, 0]).clasificacion,
      ).toBe(Clasificacion.BAJO);
    });

    it('un grupo sin indicadores con valor queda sin promedio ni aporte', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [
            indicadorDePrueba('MBA-01', GrupoMedidas.MBA),
            indicadorDePrueba('MBR-01', GrupoMedidas.MBR),
          ],
          evaluaciones: [evaluacionDePrueba(1, 'MBA-01', [2, 2])],
        }),
      );
      const mbr = resultado.grupos.find((grupo) => grupo.grupo === 'MBR');
      expect(mbr?.promedio).toBeNull();
      expect(mbr?.aporte).toBeNull();
      // El final suma solo lo que tiene valor.
      expect(resultado.final).toBe(35);
    });

    it('sin ningún dato no hay final ni clasificación', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBA-01', GrupoMedidas.MBA)],
        }),
      );
      expect(resultado.final).toBeNull();
      expect(resultado.clasificacion).toBeNull();
      expect(resultado.completo).toBe(false);
    });

    it('en traspatio no hay MBG y los pesos son 60/40 (RF33)', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          grupoProductivo: GrupoProductivo.POLLO_ENGORDE,
          tipoPredio: TipoPredio.TRASPATIO,
          indicadores: [
            indicadorDePrueba('MBA-01', GrupoMedidas.MBA),
            indicadorDePrueba('MBR-01', GrupoMedidas.MBR),
            indicadorDePrueba('MBG-01', GrupoMedidas.MBG),
          ],
          evaluaciones: [
            evaluacionDePrueba(1, 'MBA-01', [2, 2]),
            evaluacionDePrueba(1, 'MBR-01', [1, 1]),
          ],
          documentos: [documentoDePrueba('MBG-01', 2)],
          fase3Aplica: false,
          reglasFase2: reglasFase2(
            TipoPredio.TRASPATIO,
            GrupoProductivo.POLLO_ENGORDE,
          ),
        }),
      );
      expect(
        resultado.indicadores.some(
          (indicador) => indicador.grupo === GrupoMedidas.MBG,
        ),
      ).toBe(false);
      expect(resultado.final).toBe(100 * 0.6 + 50 * 0.4);
    });
  });

  describe('«No aplica» (RF25)', () => {
    it('un indicador excluido no entra en el promedio de su grupo', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [
            indicadorDePrueba('MBR-01', GrupoMedidas.MBR),
            indicadorDePrueba('MBR-02', GrupoMedidas.MBR),
          ],
          evaluaciones: [
            evaluacionDePrueba(1, 'MBR-01', [1, 1]),
            evaluacionDePrueba(1, 'MBR-02', [], {
              noAplica: true,
              motivoNoAplica: 'No hay bebederos en este galpón.',
            }),
          ],
        }),
      );
      const mbr02 = resultado.indicadores.find(
        (indicador) => indicador.codigo === 'MBR-02',
      );
      const mbr = resultado.grupos.find((grupo) => grupo.grupo === 'MBR');
      expect(mbr02?.noAplica).toBe(true);
      expect(mbr02?.valor).toBeNull();
      expect(mbr?.indicadoresConValor).toBe(1);
      expect(mbr?.promedio).toBe(50);
      expect(mbr?.aporte).toBe(17.5);
    });

    it('el «No aplica» con motivo cuenta como indicador terminado (RF25)', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBR-02', GrupoMedidas.MBR)],
          evaluaciones: [
            evaluacionDePrueba(1, 'MBR-02', [], {
              noAplica: true,
              motivoNoAplica: 'No hay bebederos.',
            }),
          ],
        }),
      );
      expect(resultado.indicadores[0].completo).toBe(true);
      expect(resultado.completo).toBe(true);
    });
  });

  describe('completitud del cálculo (RF26, RF37)', () => {
    it('una visita terminada queda completa', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [
            indicadorDePrueba('MBA-01', GrupoMedidas.MBA),
            indicadorDePrueba('MBG-01', GrupoMedidas.MBG),
          ],
          evaluaciones: [
            evaluacionDePrueba(1, 'MBA-01', [2, 2, 1, 1, 2, 2, 1, 1, 2]),
          ],
          documentos: [documentoDePrueba('MBG-01', 1)],
        }),
      );
      expect(resultado.completo).toBe(true);
    });

    it('un documento pendiente sin puntaje deja el cálculo incompleto (RF31)', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBG-01', GrupoMedidas.MBG)],
          documentos: [
            documentoDePrueba('MBG-01', null, {
              presentado: false,
              pendiente: true,
            }),
          ],
        }),
      );
      expect(resultado.indicadores[0].completo).toBe(false);
      expect(resultado.completo).toBe(false);
    });

    it('sin galpones marcados los indicadores de la Fase II no están completos (RF16)', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBA-01', GrupoMedidas.MBA)],
          galpones: [],
        }),
      );
      expect(resultado.indicadores[0].completo).toBe(false);
    });
  });

  describe('rangos del catálogo (RF38)', () => {
    const engorde: RangoEscala[] = [
      { puntaje: 2, max: 6 },
      { puntaje: 1, max: 9 },
      { puntaje: 0, max: null },
    ];
    const ponedoras: RangoEscala[] = [
      { puntaje: 2, max: 12 },
      { puntaje: 1, max: 14 },
      { puntaje: 0, max: null },
    ];

    it('en engorde: hasta 6 % son 2, hasta 9 % es 1 y más es 0 (RF30)', () => {
      expect(puntajePorRangos(0, engorde)).toBe(2);
      expect(puntajePorRangos(6, engorde)).toBe(2);
      expect(puntajePorRangos(6.5, engorde)).toBe(1);
      expect(puntajePorRangos(9, engorde)).toBe(1);
      expect(puntajePorRangos(9.1, engorde)).toBe(0);
    });

    it('en ponedoras: hasta 12 % son 2, hasta 14 % es 1 y más es 0 (RF30)', () => {
      expect(puntajePorRangos(12, ponedoras)).toBe(2);
      expect(puntajePorRangos(12.01, ponedoras)).toBe(1);
      expect(puntajePorRangos(14, ponedoras)).toBe(1);
      expect(puntajePorRangos(14.1, ponedoras)).toBe(0);
    });

    it('unos rangos sin rango abierto no cubren la medición', () => {
      expect(puntajePorRangos(20, [{ puntaje: 2, max: 6 }])).toBeNull();
    });

    it('los rangos se leen del catálogo, por grupo productivo', () => {
      const mortalidad = indicadorDePrueba('MBG-09', GrupoMedidas.MBG, {
        tipoEvaluacion: TipoEvaluacion.MORTALIDAD,
        escalaRangos: {
          [GrupoProductivo.POLLO_ENGORDE]: engorde,
          [GrupoProductivo.PONEDORA_PISO]: ponedoras,
        },
      });
      expect(rangosDe(mortalidad, GrupoProductivo.POLLO_ENGORDE)).toEqual(
        engorde,
      );
      expect(rangosDe(mortalidad, GrupoProductivo.PONEDORA_JAULA)).toBeNull();
      expect(rangosDe(mortalidad, null)).toBeNull();
    });
  });

  describe('resumen guardado (M6)', () => {
    it('guarda grupos, final, clasificación y fecha', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBG-01', GrupoMedidas.MBG)],
          documentos: [documentoDePrueba('MBG-01', 2)],
        }),
      );
      const guardado = resultadoPara(
        resultado,
        new Date('2026-10-16T12:00:00Z'),
      );
      expect(guardado.completo).toBe(true);
      expect(guardado.final).toBe(30);
      expect(guardado.clasificacion).toBe(Clasificacion.BAJO);
      expect(guardado.calculadoEn).toBe('2026-10-16T12:00:00.000Z');
      expect(guardado.grupos.map((grupo) => grupo.grupo)).toEqual([
        'MBA',
        'MBR',
        'MBG',
      ]);
    });
  });

  describe('cierre con documentos pendientes (M7 · RF43/RF44)', () => {
    it('un documento pendiente deja el cálculo en vivo incompleto (M6)', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBG-01', GrupoMedidas.MBG)],
          documentos: [documentoDePrueba('MBG-01', null, { pendiente: true })],
        }),
      );
      expect(resultado.indicadores[0].valor).toBeNull();
      expect(resultado.indicadores[0].completo).toBe(false);
      expect(resultado.completo).toBe(false);
      expect(resultado.final).toBeNull();
    });

    it('el cierre los cuenta como 0 (RF29) y permite firmar la acta provisional', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBG-01', GrupoMedidas.MBG)],
          documentos: [documentoDePrueba('MBG-01', null, { pendiente: true })],
          pendientesCuentanCero: true,
        }),
      );
      expect(resultado.indicadores[0].valor).toBe(0);
      expect(resultado.indicadores[0].completo).toBe(true);
      expect(resultado.completo).toBe(true);
      expect(resultado.final).not.toBeNull();
    });

    it('un documento entregado no cambia con el modo del cierre', () => {
      const resultado = calcularVisita(
        entradaDePrueba({
          indicadores: [indicadorDePrueba('MBG-01', GrupoMedidas.MBG)],
          documentos: [documentoDePrueba('MBG-01', 2)],
          pendientesCuentanCero: true,
        }),
      );
      expect(resultado.indicadores[0].valor).toBe(100);
      expect(resultado.completo).toBe(true);
    });
  });
});
