import {
  EstadoVisita,
  TRANSICIONES_ESTADO,
  esEditable,
  puedeCambiarEstado,
} from './visitas.tipos.js';

describe('Estados de la visita (RF09)', () => {
  it('empieza programada y pasa a en curso cuando el inspector la abre', () => {
    expect(
      puedeCambiarEstado(EstadoVisita.PROGRAMADA, EstadoVisita.EN_CURSO),
    ).toBe(true);
  });

  it('desde «En curso» se puede pedir documentos o cerrar', () => {
    expect(
      puedeCambiarEstado(
        EstadoVisita.EN_CURSO,
        EstadoVisita.PENDIENTE_DOCUMENTOS,
      ),
    ).toBe(true);
    expect(
      puedeCambiarEstado(EstadoVisita.EN_CURSO, EstadoVisita.CERRADA),
    ).toBe(true);
  });

  it('si el productor entrega antes, la inspección continúa', () => {
    expect(
      puedeCambiarEstado(
        EstadoVisita.PENDIENTE_DOCUMENTOS,
        EstadoVisita.EN_CURSO,
      ),
    ).toBe(true);
    expect(
      puedeCambiarEstado(
        EstadoVisita.PENDIENTE_DOCUMENTOS,
        EstadoVisita.CERRADA,
      ),
    ).toBe(true);
  });

  it('una visita cerrada no vuelve atrás ni se edita', () => {
    expect(TRANSICIONES_ESTADO[EstadoVisita.CERRADA]).toHaveLength(0);
    expect(esEditable(EstadoVisita.CERRADA)).toBe(false);
  });

  it('no se puede cerrar una visita que nunca se abrió', () => {
    expect(
      puedeCambiarEstado(EstadoVisita.PROGRAMADA, EstadoVisita.CERRADA),
    ).toBe(false);
  });

  it('las visitas abiertas sí se editan', () => {
    expect(esEditable(EstadoVisita.PROGRAMADA)).toBe(true);
    expect(esEditable(EstadoVisita.EN_CURSO)).toBe(true);
    expect(esEditable(EstadoVisita.PENDIENTE_DOCUMENTOS)).toBe(true);
  });
});
