import {
  fase4Vacia,
  posicionEnEscala,
  tonoClasificacion,
  tonoPrioridad,
  type IndicadorMejora,
} from './cierre.modelos';

/** Renglón de indicador a mejorar de prueba (RF40). */
function fila(parcial: Partial<IndicadorMejora> = {}): IndicadorMejora {
  return {
    codigo: 'MBA-01',
    nombre: 'Indicador de prueba',
    grupo: 'MBA',
    etiquetaGrupo: 'Animal (MBA)',
    valor: 100,
    pendiente: false,
    prioridad: 'SIN_PRIORIDAD',
    etiquetaPrioridad: 'Sin prioridad',
    ...parcial,
  };
}

/** Reglas de la pantalla de cierre (M7 · RF39–RF45). */
describe('cierre.modelos (M7)', () => {
  it('posiciona el marcador de la escala entre 0 y 100 (RF39)', () => {
    expect(posicionEnEscala(null)).toBeNull();
    expect(posicionEnEscala(0)).toBe(0);
    expect(posicionEnEscala(96.11)).toBe(96.11);
    expect(posicionEnEscala(150)).toBe(100);
    expect(posicionEnEscala(-4)).toBe(0);
  });

  it('traduce la clasificación al tono de su insignia', () => {
    expect(tonoClasificacion('EXCELENTE')).toBe('excelente');
    expect(tonoClasificacion('ALTO')).toBe('alto');
    expect(tonoClasificacion('MEDIO')).toBe('medio');
    expect(tonoClasificacion('BAJO')).toBe('bajo');
    expect(tonoClasificacion(null)).toBe('neutro');
  });

  it('pinta la prioridad de mejora como la Fase III (RF40)', () => {
    expect(tonoPrioridad(fila({ prioridad: 'ALTA' }))).toBe('peligro');
    expect(tonoPrioridad(fila({ prioridad: 'MEDIA' }))).toBe('advertencia');
    expect(tonoPrioridad(fila({ prioridad: 'SIN_PRIORIDAD' }))).toBe('acento');
    // Los pendientes se pintan como advertencia, igual que en la Fase III.
    expect(
      tonoPrioridad(
        fila({ pendiente: true, prioridad: null, etiquetaPrioridad: null }),
      ),
    ).toBe('advertencia');
  });

  it('el cierre vacío deja la pantalla lista para pintar', () => {
    const vacia = fase4Vacia();
    expect(vacia.final).toBeNull();
    expect(vacia.acta).toBeNull();
    expect(vacia.puedeEmitir).toBe(false);
    expect(vacia.motivoNoEmitir).toContain('no ha comenzado');
  });
});
