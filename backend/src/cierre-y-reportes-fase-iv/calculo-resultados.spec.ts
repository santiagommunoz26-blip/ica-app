import {
  CierreYReportesFaseIvService,
  escalaVerificada,
  puntajeDisponible,
} from './cierre-y-reportes-fase-iv.service.js';
import type { IndicadorMetodologia } from '../administracion-de-la-metodologia/entities/indicador-metodologia.entity.js';
import type { PesoGrupo } from '../administracion-de-la-metodologia/entities/peso-grupo.entity.js';

describe('Cierre M7', () => {
  it('calcula porcentajes, aportes ponderados, prioridad y clasificación ICA', () => {
    const servicio = Object.create(CierreYReportesFaseIvService.prototype) as CierreYReportesFaseIvService;
    type Calcular = (
      grupo: string,
      respuestas: Array<{ indicadorId: string; puntaje: number }>,
      indicadores: IndicadorMetodologia[],
      pesos: PesoGrupo[],
      observaciones: string | null,
    ) => {
      calificacionFinal: number;
      clasificacion: string;
      grupos: Array<{ grupoMedida: string; promedio: number; peso: number; aporte: number }>;
      indicadores: Array<{ puntaje: number; porcentaje: number; prioridad: string }>;
    };
    const calcular = Reflect.get(servicio, 'calcularResultado') as Calcular;
    const escala = {
      '0': 'Criterio 0.',
      '1': 'Criterio 1.',
      '2': 'Criterio 2.',
    };
    const indicadores = [
      { id: 'a', clave: 'A', nombre: 'Animal', grupoMedida: 'MBA', escalaPuntaje: escala },
      { id: 'b', clave: 'B', nombre: 'Animal 2', grupoMedida: 'MBA', escalaPuntaje: escala },
      { id: 'c', clave: 'C', nombre: 'Recurso', grupoMedida: 'MBR', escalaPuntaje: escala },
      { id: 'd', clave: 'D', nombre: 'Gestión', grupoMedida: 'MBG', escalaPuntaje: escala },
    ] as IndicadorMetodologia[];
    const resultado = calcular(
      'POLLO_ENGORDE',
      [
        { indicadorId: 'a', puntaje: 2 },
        { indicadorId: 'b', puntaje: 0 },
        { indicadorId: 'c', puntaje: 1 },
        { indicadorId: 'd', puntaje: 2 },
      ],
      indicadores,
      [
        { grupoMedida: 'MBA', porcentaje: '35' },
        { grupoMedida: 'MBR', porcentaje: '35' },
        { grupoMedida: 'MBG', porcentaje: '30' },
      ] as PesoGrupo[],
      null,
    );

    expect(resultado.grupos.map((grupo) => grupo.aporte)).toEqual([17.5, 17.5, 30]);
    expect(resultado.calificacionFinal).toBe(65);
    expect(resultado.clasificacion).toBe('MEDIO');
    expect(resultado.indicadores.map((item) => item.prioridad)).toEqual([
      'ALTA',
      'MEDIA',
      'BAJA',
      'BAJA',
    ]);
  });

  it('bloquea escalas sin verificar y acepta una escala binaria oficial', () => {
    expect(
      escalaVerificada({
        escalaPuntaje: {
          '0': 'Puntaje 0. Consultar criterio oficial de la tabla ICA.',
          '1': 'Puntaje 1. Consultar criterio oficial de la tabla ICA.',
          '2': 'Puntaje 2. Consultar criterio oficial de la tabla ICA.',
        },
      } as IndicadorMetodologia),
    ).toBe(false);
    expect(
      escalaVerificada({
        escalaPuntaje: {
          '0': 'Criterio oficial bajo.',
          '1': 'Criterio oficial parcial.',
          '2': 'Criterio oficial completo.',
        },
      } as IndicadorMetodologia),
    ).toBe(true);
    const binaria = {
      escalaPuntaje: {
        '0': 'Criterio de menor bienestar.',
        '1': '[NO_APLICA] La fuente solo define los puntajes 0 y 2.',
        '2': 'Criterio de mayor bienestar.',
      },
    } as IndicadorMetodologia;
    expect(escalaVerificada(binaria)).toBe(true);
    expect(puntajeDisponible(binaria, 0)).toBe(true);
    expect(puntajeDisponible(binaria, 1)).toBe(false);
    expect(puntajeDisponible(binaria, 2)).toBe(true);
    expect(puntajeDisponible(binaria, 1.5)).toBe(false);

    const servicio = Object.create(CierreYReportesFaseIvService.prototype) as CierreYReportesFaseIvService;
    const validarRespuestas = Reflect.get(servicio, 'validarRespuestas') as (
      respuestas: Array<{ indicadorId: string; puntaje: number }>,
      indicadores: IndicadorMetodologia[],
    ) => unknown;
    const indicadorBinario = {
      id: 'binaria',
      nombre: 'Escala binaria',
      escalaPuntaje: binaria.escalaPuntaje,
    } as IndicadorMetodologia;
    expect(() =>
      validarRespuestas([{ indicadorId: 'binaria', puntaje: 1 }], [
        indicadorBinario,
      ]),
    ).toThrow('El puntaje 1 no está definido para Escala binaria.');
    expect(
      validarRespuestas([{ indicadorId: 'binaria', puntaje: 2 }], [
        indicadorBinario,
      ]),
    ).toEqual([{ indicadorId: 'binaria', puntaje: 2 }]);
  });
});
