import { reglasFase2, type EvaluacionFase2 } from './fase2.modelos';
import type { PuntoEvaluado } from './fase2.modelos';
import type { DocumentoEvaluado } from './fase3.modelos';
import {
  calcularVisita,
  clasificar,
  puntajePorRangos,
  rangosDe,
  type EntradaCalculo,
} from './calculo.modelos';
import type {
  GrupoMedidas,
  IndicadorCatalogo,
  PesoGrupo,
  RangoEscala,
} from './inspeccion.modelos';

/**
 * Pruebas del motor de cálculo del frontend (M6 · RF34–RF38).
 *
 * El espejo debe dar los mismos números que el backend: el ejemplo verificado
 * contra el motor del spike (`docs/spike-form-engine/`) es MBA 79,17, MBR
 * 50,00 y MBG 100,00 (pesos 35/35/30) → final 75,21 y clasificación Alto
 * (RNF03).
 */

const GRUPOS = ['POLLO_ENGORDE', 'PONEDORA_PISO', 'PONEDORA_JAULA'] as const;

/** Indicador de prueba, con los valores del catálogo provisional. */
function indicadorDePrueba(
  codigo: string,
  grupo: GrupoMedidas,
  extra: Partial<IndicadorCatalogo> = {},
): IndicadorCatalogo {
  return {
    codigo,
    nombre: `Indicador ${codigo}`,
    grupo,
    etiquetaGrupo: grupo,
    metodo: null,
    orden: 0,
    escalaMin: 0,
    escalaMax: 2,
    escalaDescripciones: null,
    tipoMuestreo: 'PUNTOS_9',
    pregunta: null,
    tipoEvaluacion: 'PUNTAJE',
    escalaRangos: null,
    exigeFirmaProfesional: false,
    gruposProductivos: [...GRUPOS],
    ...extra,
  };
}

/** Los pesos de la metodología: corral 35/35/30; traspatio 60/40 (RF14). */
const PESOS_CORRAL: PesoGrupo[] = [
  { grupo: 'MBA', etiqueta: 'Animal (MBA)', peso: 35 },
  { grupo: 'MBR', etiqueta: 'Recursos (MBR)', peso: 35 },
  { grupo: 'MBG', etiqueta: 'Gestión (MBG)', peso: 30 },
];

const PESOS_TRASPATIO: PesoGrupo[] = [
  { grupo: 'MBA', etiqueta: 'Animal (MBA)', peso: 60 },
  { grupo: 'MBR', etiqueta: 'Recursos (MBR)', peso: 40 },
  { grupo: 'MBG', etiqueta: 'Gestión (MBG)', peso: 0 },
];

/** Puntos con muestra válida en piso (15–30 aves, RF20). */
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
  return {
    indicadores: [],
    pesos: PESOS_CORRAL,
    galpones: [1],
    evaluaciones: [],
    documentos: [],
    fase3Aplica: true,
    reglasFase2: reglasFase2('CORRAL', 'POLLO_ENGORDE'),
    ...extra,
  };
}

describe('Motor de cálculo (RF34–RF38), espejo del backend', () => {
  it('valor del indicador: promedio × 100 / escala máxima (RF34)', () => {
    const resultado = calcularVisita(
      entradaDePrueba({
        indicadores: [indicadorDePrueba('MBA-01', 'MBA')],
        evaluaciones: [evaluacionDePrueba(1, 'MBA-01', [2, 2, 1, 1])],
      }),
    );
    // (2 + 2 + 1 + 1) / 4 = 1,5 → (1,5 × 100) / 2 = 75.
    expect(resultado.indicadores[0].valor).toBe(75);
    expect(resultado.indicadores[0].completo).toBe(false);
  });

  it('con varios galpones, el valor es el promedio de los galpones (RF34)', () => {
    const resultado = calcularVisita(
      entradaDePrueba({
        indicadores: [indicadorDePrueba('MBA-01', 'MBA')],
        galpones: [1, 2],
        evaluaciones: [
          evaluacionDePrueba(1, 'MBA-01', [2, 2]),
          evaluacionDePrueba(2, 'MBA-01', [1, 1]),
        ],
      }),
    );
    expect(resultado.indicadores[0].valor).toBe(75);
    expect(
      resultado.indicadores[0].galpones.map((galpon) => galpon.valor),
    ).toEqual([100, 50]);
  });

  it('el ejemplo verificado: 75,21 y clasificación Alto (RNF03)', () => {
    const resultado = calcularVisita(
      entradaDePrueba({
        indicadores: [
          indicadorDePrueba('MBA-01', 'MBA'),
          indicadorDePrueba('MBA-02', 'MBA'),
          indicadorDePrueba('MBR-01', 'MBR'),
          indicadorDePrueba('MBG-01', 'MBG'),
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
    expect(resultado.clasificacion).toBe('ALTO');
    expect(resultado.etiquetaClasificacion).toBe('Alto');
  });

  it('los grupos sin datos no aportan y el cálculo queda en curso (RF35)', () => {
    const resultado = calcularVisita(
      entradaDePrueba({
        indicadores: [
          indicadorDePrueba('MBA-01', 'MBA'),
          indicadorDePrueba('MBR-01', 'MBR'),
        ],
        evaluaciones: [evaluacionDePrueba(1, 'MBA-01', [2, 2])],
      }),
    );
    const mbr = resultado.grupos.find((grupo) => grupo.grupo === 'MBR');
    expect(mbr?.promedio).toBeNull();
    expect(mbr?.aporte).toBeNull();
    // El final suma solo lo que tiene valor: 100 × 35 % = 35.
    expect(resultado.final).toBe(35);
    expect(resultado.completo).toBe(false);
  });

  it('en traspatio no hay MBG y los pesos son 60/40 (RF33)', () => {
    const resultado = calcularVisita(
      entradaDePrueba({
        indicadores: [
          indicadorDePrueba('MBA-01', 'MBA'),
          indicadorDePrueba('MBR-01', 'MBR'),
          indicadorDePrueba('MBG-01', 'MBG'),
        ],
        evaluaciones: [
          evaluacionDePrueba(1, 'MBA-01', [2, 2]),
          evaluacionDePrueba(1, 'MBR-01', [1, 1]),
        ],
        documentos: [documentoDePrueba('MBG-01', 2)],
        fase3Aplica: false,
        pesos: PESOS_TRASPATIO,
        reglasFase2: reglasFase2('TRASPATIO', 'POLLO_ENGORDE'),
      }),
    );
    expect(
      resultado.indicadores.some((indicador) => indicador.grupo === 'MBG'),
    ).toBe(false);
    expect(resultado.final).toBe(100 * 0.6 + 50 * 0.4);
  });

  it('«No aplica» sale del promedio del grupo (RF25)', () => {
    const resultado = calcularVisita(
      entradaDePrueba({
        indicadores: [
          indicadorDePrueba('MBR-01', 'MBR'),
          indicadorDePrueba('MBR-02', 'MBR'),
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
    expect(mbr02?.noAplica).toBe(true);
    expect(mbr02?.valor).toBeNull();
    // El «No aplica» con motivo cuenta como terminado; el grupo promedia solo
    // el indicador con valor.
    expect(mbr02?.completo).toBe(true);
    const mbr = resultado.grupos.find((grupo) => grupo.grupo === 'MBR');
    expect(mbr?.indicadoresConValor).toBe(1);
    expect(mbr?.promedio).toBe(50);
    expect(mbr?.aporte).toBe(17.5);
  });

  it('una visita terminada queda completa (RF26, RF37)', () => {
    const resultado = calcularVisita(
      entradaDePrueba({
        indicadores: [
          indicadorDePrueba('MBA-01', 'MBA'),
          indicadorDePrueba('MBG-01', 'MBG'),
        ],
        evaluaciones: [
          evaluacionDePrueba(1, 'MBA-01', [2, 2, 2, 2, 2, 2, 2, 2, 2]),
        ],
        documentos: [documentoDePrueba('MBG-01', 1)],
      }),
    );
    expect(resultado.completo).toBe(true);
    // 100 × 35 % + 50 × 30 % = 35 + 15 = 50 → Medio (el corte es incluido).
    expect(resultado.final).toBe(50);
    expect(resultado.clasificacion).toBe('MEDIO');
  });

  it('los rangos de la mortalidad salen del catálogo (RF30, RF38)', () => {
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
    expect(puntajePorRangos(0, engorde)).toBe(2);
    expect(puntajePorRangos(6, engorde)).toBe(2);
    expect(puntajePorRangos(7.5, engorde)).toBe(1);
    expect(puntajePorRangos(9, engorde)).toBe(1);
    expect(puntajePorRangos(10, engorde)).toBe(0);
    expect(puntajePorRangos(13, ponedoras)).toBe(1);
    expect(puntajePorRangos(20, [{ puntaje: 2, max: 6 }])).toBeNull();

    const mortalidad = indicadorDePrueba('MBG-09', 'MBG', {
      tipoEvaluacion: 'MORTALIDAD',
      escalaRangos: {
        POLLO_ENGORDE: engorde,
        PONEDORA_PISO: ponedoras,
      },
    });
    expect(rangosDe(mortalidad, 'POLLO_ENGORDE')).toEqual(engorde);
    expect(rangosDe(mortalidad, 'PONEDORA_JAULA')).toBeNull();
    expect(rangosDe(mortalidad, null)).toBeNull();
  });

  it('la clasificación del final es la de la metodología (RF36)', () => {
    expect(clasificar(100)).toBe('EXCELENTE');
    expect(clasificar(90)).toBe('EXCELENTE');
    expect(clasificar(89.99)).toBe('ALTO');
    expect(clasificar(75)).toBe('ALTO');
    expect(clasificar(74.99)).toBe('MEDIO');
    expect(clasificar(50)).toBe('MEDIO');
    expect(clasificar(49.99)).toBe('BAJO');
  });
});
