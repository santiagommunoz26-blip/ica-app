import type { Indicador } from '../metodologia/entities/indicador.entity.js';
import {
  GrupoMedidas,
  GrupoProductivo,
  TipoEvaluacion,
  TipoMuestreo,
  type RangosEscala,
} from '../metodologia/metodologia.tipos.js';
import { TipoPredio } from '../visitas/visitas.tipos.js';
import { rangosDe } from './calculo.reglas.js';
import {
  avanceFase3,
  documentoVerificado,
  erroresDeDocumento,
  reglasFase3,
} from './fase3.reglas.js';
import type { DocumentoEvaluado } from './fase3.tipos.js';

/** Indicador de prueba, con los valores del catálogo provisional. */
function indicadorDePrueba(
  codigo: string,
  extra: Partial<Indicador> = {},
): Indicador {
  return {
    id: `id-${codigo}`,
    metodologiaId: 'metodologia-1',
    grupo: GrupoMedidas.MBG,
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

/** Documento con valores por defecto sensatos para las pruebas. */
function documentoDePrueba(
  extra: Partial<DocumentoEvaluado> = {},
): DocumentoEvaluado {
  return {
    indicadorCodigo: 'MBG-01',
    presentado: null,
    legible: false,
    firmadoResponsable: false,
    firmadoProfesional: null,
    mortalidad: null,
    puntaje: null,
    pendiente: false,
    guardadoEn: '2026-10-16T09:00:00.000Z',
    ...extra,
  };
}

/** Los rangos de mortalidad del catálogo (RF30), por grupo productivo. */
const RANGOS_MORTALIDAD: RangosEscala = {
  [GrupoProductivo.POLLO_ENGORDE]: [
    { puntaje: 2, max: 6 },
    { puntaje: 1, max: 9 },
    { puntaje: 0, max: null },
  ],
  [GrupoProductivo.PONEDORA_PISO]: [
    { puntaje: 2, max: 12 },
    { puntaje: 1, max: 14 },
    { puntaje: 0, max: null },
  ],
  [GrupoProductivo.PONEDORA_JAULA]: [
    { puntaje: 2, max: 12 },
    { puntaje: 1, max: 14 },
    { puntaje: 0, max: null },
  ],
};

/** El indicador de mortalidad del catálogo provisional (MBG-09). */
const MORTALIDAD = indicadorDePrueba('MBG-09', {
  tipoEvaluacion: TipoEvaluacion.MORTALIDAD,
  escalaRangos: RANGOS_MORTALIDAD,
});

describe('Reglas de la Fase III (RF27–RF33)', () => {
  describe('reglas de la fase documental (RF30, RF33)', () => {
    it('solo aplica en corral; en traspatio no hay fase documental (RF33)', () => {
      expect(
        reglasFase3(TipoPredio.CORRAL, GrupoProductivo.POLLO_ENGORDE).aplica,
      ).toBe(true);
      expect(
        reglasFase3(TipoPredio.TRASPATIO, GrupoProductivo.POLLO_ENGORDE).aplica,
      ).toBe(false);
    });
  });

  describe('rangos del catálogo (RF38)', () => {
    it('los rangos de la mortalidad salen del catálogo, por grupo productivo', () => {
      expect(rangosDe(MORTALIDAD, GrupoProductivo.POLLO_ENGORDE)).toEqual(
        RANGOS_MORTALIDAD[GrupoProductivo.POLLO_ENGORDE],
      );
      expect(rangosDe(MORTALIDAD, GrupoProductivo.PONEDORA_PISO)).toEqual(
        RANGOS_MORTALIDAD[GrupoProductivo.PONEDORA_PISO],
      );
      expect(rangosDe(MORTALIDAD, null)).toBeNull();
    });

    it('un indicador sin rangos no tiene escala numérica', () => {
      expect(
        rangosDe(indicadorDePrueba('MBG-01'), GrupoProductivo.POLLO_ENGORDE),
      ).toBeNull();
    });
  });

  describe('verificación y avance (RF24, RF31)', () => {
    it('un documento cuenta como verificado si está calificado o pendiente', () => {
      expect(documentoVerificado(documentoDePrueba())).toBe(false);
      expect(documentoVerificado(documentoDePrueba({ puntaje: 0 }))).toBe(true);
      expect(documentoVerificado(documentoDePrueba({ pendiente: true }))).toBe(
        true,
      );
      expect(documentoVerificado(undefined)).toBe(false);
    });

    it('el avance cuenta los verificados sobre el total', () => {
      const indicadores = [
        indicadorDePrueba('MBG-01'),
        indicadorDePrueba('MBG-02'),
        indicadorDePrueba('MBG-03'),
      ];
      const documentos = [
        documentoDePrueba({ indicadorCodigo: 'MBG-01', puntaje: 2 }),
        documentoDePrueba({ indicadorCodigo: 'MBG-02', pendiente: true }),
      ];
      expect(avanceFase3(documentos, indicadores)).toEqual({
        verificados: 2,
        total: 3,
      });
    });
  });

  describe('errores de un documento (RF28–RF30)', () => {
    it('acepta un documento a medio llenar (RF26)', () => {
      expect(
        erroresDeDocumento(
          documentoDePrueba(),
          indicadorDePrueba('MBG-01'),
          GrupoProductivo.POLLO_ENGORDE,
        ),
      ).toEqual([]);
      expect(
        erroresDeDocumento(
          documentoDePrueba({ presentado: true }),
          indicadorDePrueba('MBG-01'),
          GrupoProductivo.POLLO_ENGORDE,
        ),
      ).toEqual([]);
    });

    it('sin documento, el puntaje debe ser 0 (RF29)', () => {
      const errores = erroresDeDocumento(
        documentoDePrueba({ presentado: false, puntaje: 2 }),
        indicadorDePrueba('MBG-01'),
        GrupoProductivo.POLLO_ENGORDE,
      );
      expect(errores[0]).toContain('el puntaje es 0');
      expect(
        erroresDeDocumento(
          documentoDePrueba({ presentado: false, puntaje: 0 }),
          indicadorDePrueba('MBG-01'),
          GrupoProductivo.POLLO_ENGORDE,
        ),
      ).toEqual([]);
    });

    it('no admite puntaje sin saber si el documento se presentó', () => {
      const errores = erroresDeDocumento(
        documentoDePrueba({ puntaje: 1 }),
        indicadorDePrueba('MBG-01'),
        GrupoProductivo.POLLO_ENGORDE,
      );
      expect(errores[0]).toContain(
        'indique primero si el documento se presentó',
      );
    });

    it('valida el puntaje de los documentos normales (RF19)', () => {
      const errores = erroresDeDocumento(
        documentoDePrueba({ presentado: true, puntaje: 3 }),
        indicadorDePrueba('MBG-01'),
        GrupoProductivo.POLLO_ENGORDE,
      );
      expect(errores[0]).toContain('puntaje debe ser 0, 1 o 2');
    });

    it('la mortalidad exige una tasa de 0 % a 100 % con dos decimales (RF30)', () => {
      const fueraDeRango = erroresDeDocumento(
        documentoDePrueba({ presentado: true, mortalidad: 120 }),
        MORTALIDAD,
        GrupoProductivo.POLLO_ENGORDE,
      );
      expect(fueraDeRango[0]).toContain('entre 0 % y 100 %');

      const conTresDecimales = erroresDeDocumento(
        documentoDePrueba({ presentado: true, mortalidad: 7.555 }),
        MORTALIDAD,
        GrupoProductivo.POLLO_ENGORDE,
      );
      expect(conTresDecimales[0]).toContain('máximo 2 decimales');
    });

    it('el puntaje de la mortalidad tiene que salir de los rangos (RF30)', () => {
      // 7,5 % en engorde es 1 punto: un 2 digitado es un error.
      const incoherente = erroresDeDocumento(
        documentoDePrueba({ presentado: true, mortalidad: 7.5, puntaje: 2 }),
        MORTALIDAD,
        GrupoProductivo.POLLO_ENGORDE,
      );
      expect(incoherente[0]).toContain('sale de los rangos');

      expect(
        erroresDeDocumento(
          documentoDePrueba({ presentado: true, mortalidad: 7.5, puntaje: 1 }),
          MORTALIDAD,
          GrupoProductivo.POLLO_ENGORDE,
        ),
      ).toEqual([]);
    });

    it('si el catálogo no trae los rangos, la mortalidad no se puede calificar (RF38)', () => {
      const sinRangos = indicadorDePrueba('MBG-09', {
        tipoEvaluacion: TipoEvaluacion.MORTALIDAD,
      });
      const errores = erroresDeDocumento(
        documentoDePrueba({ presentado: true, mortalidad: 7.5, puntaje: 1 }),
        sinRangos,
        GrupoProductivo.POLLO_ENGORDE,
      );
      expect(errores[0]).toContain('no tiene los rangos');
    });
  });
});
