import { Clasificacion, EstadoVisita } from '../../visitas/visitas.tipos.js';
import { GrupoMedidas } from '../../metodologia/metodologia.tipos.js';
import type { Indicador } from '../../metodologia/entities/indicador.entity.js';
import type { CalculoVisita } from '../calculo.tipos.js';
import type { Acta } from '../entities/acta.entity.js';
import type { DocumentoEvaluado } from '../fase3.tipos.js';
import {
  decidirEmision,
  filasDeMejora,
  mapearFase4,
} from './fase4-respuesta.dto.js';

/** Indicador mínimo del catálogo para las pruebas (solo lo que se usa). */
function indicador(codigo: string, nombre: string, grupo: GrupoMedidas) {
  return { codigo, nombre, grupo } as unknown as Indicador;
}

/** Documento de la Fase III mínimo para las pruebas. */
function documento(
  indicadorCodigo: string,
  extra: Partial<DocumentoEvaluado> = {},
): DocumentoEvaluado {
  return {
    indicadorCodigo,
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

/** Cálculo mínimo con los indicadores indicados. */
function calculoCon(
  filas: { codigo: string; grupo: GrupoMedidas; valor: number | null }[],
  extra: Partial<CalculoVisita> = {},
): CalculoVisita {
  return {
    completo: true,
    indicadores: filas.map((fila) => ({
      codigo: fila.codigo,
      grupo: fila.grupo,
      valor: fila.valor,
      noAplica: false,
      completo: fila.valor !== null,
      galpones: [],
    })),
    grupos: [
      {
        grupo: GrupoMedidas.MBA,
        etiqueta: 'Animal',
        peso: 35,
        indicadoresConValor: 1,
        indicadoresTotal: 1,
        promedio: 78,
        aporte: 27.3,
      },
    ],
    final: 82.4,
    clasificacion: Clasificacion.ALTO,
    ...extra,
  };
}

/** Acta mínima para las pruebas (solo lo que se usa). */
function actaDePrueba(extra: Partial<Acta> = {}): Acta {
  return {
    id: 'acta-1',
    visitaId: 'visita-1',
    version: 1,
    definitiva: false,
    archivo: 'actas/visita-1/acta-v1.pdf',
    huella: 'a'.repeat(64),
    tamano: 1234,
    firmaArchivo: 'actas/visita-1/firma-v1.png',
    firmadaPorId: 'usuario-1',
    firmadaPorNombre: 'Ana Cruz',
    firmadaEn: new Date('2026-10-16T15:00:00Z'),
    documentosPendientes: 1,
    vencimientoDocumentos: new Date('2026-10-19T22:00:00Z'),
    calificacion: '82.40',
    clasificacion: Clasificacion.ALTO,
    correoEnviadoEn: null,
    correoDestinatario: null,
    createdAt: new Date('2026-10-16T15:00:00Z'),
    updatedAt: new Date('2026-10-16T15:00:00Z'),
    ...extra,
  } as Acta;
}

describe('Fase IV · cierre y actas (M7 · RF39–RF45)', () => {
  describe('indicadores a mejorar (RF40)', () => {
    const catalogo = [
      indicador('MBA-01', 'Podo dermatitis', GrupoMedidas.MBA),
      indicador('MBR-02', 'Calidad de la cama', GrupoMedidas.MBR),
      indicador('MBG-09', 'Mortalidad', GrupoMedidas.MBG),
      indicador('MBR-03', 'Calidad del agua', GrupoMedidas.MBR),
    ];

    it('ordena por prioridad y, dentro de ella, del menor valor al mayor', () => {
      const filas = filasDeMejora(
        calculoCon([
          { codigo: 'MBR-03', grupo: GrupoMedidas.MBR, valor: 100 },
          { codigo: 'MBA-01', grupo: GrupoMedidas.MBA, valor: 58 },
          { codigo: 'MBR-02', grupo: GrupoMedidas.MBR, valor: 75 },
          { codigo: 'MBG-09', grupo: GrupoMedidas.MBG, valor: 0 },
        ]),
        catalogo,
        [],
      );
      expect(filas.map((fila) => fila.codigo)).toEqual([
        'MBG-09',
        'MBA-01',
        'MBR-02',
        'MBR-03',
      ]);
      expect(filas.map((fila) => fila.etiquetaPrioridad)).toEqual([
        'Prioridad alta',
        'Prioridad alta',
        'Prioridad media',
        'Sin prioridad',
      ]);
    });

    it('marca los documentos pendientes y les da prioridad alta', () => {
      const filas = filasDeMejora(
        calculoCon([{ codigo: 'MBG-09', grupo: GrupoMedidas.MBG, valor: 0 }]),
        catalogo,
        [documento('MBG-09', { pendiente: true })],
      );
      expect(filas[0].pendiente).toBe(true);
      expect(filas[0].prioridad).toBe('ALTA');
      expect(filas[0].nombre).toBe('Mortalidad');
      expect(filas[0].etiquetaGrupo).toBe('Gestión (MBG)');
    });

    it('deja fuera los indicadores sin valor y los «No aplica»', () => {
      const filas = filasDeMejora(
        calculoCon([
          { codigo: 'MBA-01', grupo: GrupoMedidas.MBA, valor: null },
        ]),
        catalogo,
        [],
      );
      expect(filas).toHaveLength(0);
    });
  });

  describe('decisión de emisión (RF41–RF44)', () => {
    it('sin acta, con cálculo completo y visita editable, se puede firmar', () => {
      const decision = decidirEmision(EstadoVisita.EN_CURSO, true, false, null);
      expect(decision.puedeEmitir).toBe(true);
      expect(decision.motivo).toBeNull();
    });

    it('con indicadores sin evaluar no se firma', () => {
      const decision = decidirEmision(
        EstadoVisita.EN_CURSO,
        false,
        false,
        null,
      );
      expect(decision.puedeEmitir).toBe(false);
      expect(decision.motivo).toContain('faltan indicadores');
    });

    it('con documentos pendientes espera el plazo (RF44)', () => {
      const decision = decidirEmision(
        EstadoVisita.PENDIENTE_DOCUMENTOS,
        true,
        true,
        actaDePrueba(),
      );
      expect(decision.puedeEmitir).toBe(false);
      expect(decision.motivo).toContain('documentos pendientes');
    });

    it('si los documentos llegaron a tiempo, se firma la definitiva (RF44)', () => {
      const decision = decidirEmision(
        EstadoVisita.PENDIENTE_DOCUMENTOS,
        true,
        false,
        actaDePrueba(),
      );
      expect(decision.puedeEmitir).toBe(true);
    });

    it('una acta definitiva no se reemplaza (RNF10)', () => {
      const decision = decidirEmision(
        EstadoVisita.CERRADA,
        true,
        false,
        actaDePrueba({ definitiva: true, vencimientoDocumentos: null }),
      );
      expect(decision.puedeEmitir).toBe(false);
      expect(decision.motivo).toContain('definitiva');
    });
  });

  describe('bloque de la Fase IV', () => {
    it('arma el resumen del acta y el vencimiento', () => {
      const fase4 = mapearFase4({
        calculo: calculoCon([
          { codigo: 'MBA-01', grupo: GrupoMedidas.MBA, valor: 82.4 },
        ]),
        indicadores: [indicador('MBA-01', 'Podo dermatitis', GrupoMedidas.MBA)],
        documentos: [],
        acta: actaDePrueba(),
        estado: EstadoVisita.PENDIENTE_DOCUMENTOS,
        ahora: new Date('2026-10-17T12:00:00Z'),
      });
      expect(fase4.completo).toBe(true);
      expect(fase4.vencido).toBe(false);
      expect(fase4.documentosPendientes).toBe(0);
      expect(fase4.acta?.definitiva).toBe(false);
      expect(fase4.acta?.calificacion).toBe(82.4);
      expect(fase4.acta?.etiquetaClasificacion).toBe('Alto');
      expect(fase4.acta?.version).toBe(1);
      // El acta es provisional pero ya no quedan pendientes: los documentos
      // llegaron a tiempo y se puede firmar la definitiva (RF44).
      expect(fase4.puedeEmitir).toBe(true);
    });

    it('marca el plazo vencido cuando la fecha ya pasó (RF44)', () => {
      const fase4 = mapearFase4({
        calculo: calculoCon([]),
        indicadores: [],
        documentos: [],
        acta: actaDePrueba(),
        estado: EstadoVisita.PENDIENTE_DOCUMENTOS,
        ahora: new Date('2026-10-20T12:00:00Z'),
      });
      expect(fase4.vencido).toBe(true);
    });

    it('cuenta los indicadores sin evaluar que bloquean la firma', () => {
      const fase4 = mapearFase4({
        calculo: calculoCon(
          [
            { codigo: 'MBA-01', grupo: GrupoMedidas.MBA, valor: null },
            { codigo: 'MBR-02', grupo: GrupoMedidas.MBR, valor: 90 },
          ],
          { completo: false, final: null, clasificacion: null },
        ),
        indicadores: [],
        documentos: [],
        acta: null,
        estado: EstadoVisita.EN_CURSO,
        ahora: new Date('2026-10-16T15:00:00Z'),
      });
      expect(fase4.indicadoresSinEvaluar).toBe(1);
      expect(fase4.puedeEmitir).toBe(false);
      expect(fase4.final).toBeNull();
    });
  });
});
