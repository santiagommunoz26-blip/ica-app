import { FormArray, FormControl, FormGroup } from '@angular/forms';
import {
  entero,
  mensajeEntero,
  numerosUnicos,
  valorEntero,
} from './validadores';

describe('validadores de enteros', () => {
  const requerido = entero({ min: 0, max: 100, requerido: true });
  const opcional = entero({ min: 0, max: 10_000_000 });

  it('acepta un entero dentro del rango', () => {
    expect(opcional(new FormControl(62))).toBeNull();
    expect(opcional(new FormControl('62000'))).toBeNull();
  });

  it('acepta el vacío cuando el campo no es obligatorio', () => {
    expect(opcional(new FormControl(null))).toBeNull();
    expect(opcional(new FormControl(''))).toBeNull();
    expect(opcional(new FormControl('   '))).toBeNull();
  });

  it('exige un valor cuando el campo es obligatorio', () => {
    expect(requerido(new FormControl(null))).toEqual({ required: true });
    expect(requerido(new FormControl(''))).toEqual({ required: true });
  });

  it('rechaza letras y símbolos', () => {
    expect(opcional(new FormControl('abc'))).toEqual({ noNumero: true });
    expect(opcional(new FormControl('12a'))).toEqual({ noNumero: true });
    expect(opcional(new FormControl('diez'))).toEqual({ noNumero: true });
  });

  it('rechaza decimales y notación científica', () => {
    expect(opcional(new FormControl('1.5'))).toEqual({ noEntero: true });
    expect(opcional(new FormControl('1,5'))).toEqual({ noEntero: true });
    expect(opcional(new FormControl(1.5))).toEqual({ noEntero: true });
    expect(opcional(new FormControl('1e3'))).toEqual({ noEntero: true });
  });

  it('rechaza negativos cuando el mínimo es 0', () => {
    expect(opcional(new FormControl(-1))).toEqual({
      min: { min: 0, actual: -1 },
    });
    expect(opcional(new FormControl('-8'))).toEqual({
      min: { min: 0, actual: -8 },
    });
  });

  it('rechaza valores por encima del máximo', () => {
    expect(requerido(new FormControl(101))).toEqual({
      max: { max: 100, actual: 101 },
    });
  });

  it('convierte a entero solo cuando el valor es válido', () => {
    expect(valorEntero('42')).toBe(42);
    expect(valorEntero(7)).toBe(7);
    expect(valorEntero('abc')).toBeNull();
    expect(valorEntero('')).toBeNull();
  });

  it('explica el error en un mensaje para la persona', () => {
    const control = new FormControl<number | string | null>('abc', opcional);
    expect(mensajeEntero(control, 'el número de aves')).toBe(
      'El número de aves solo admite números, no letras ni símbolos.',
    );

    control.setValue(1.5);
    expect(mensajeEntero(control, 'el número de aves')).toBe(
      'El número de aves debe ser un número entero, sin decimales.',
    );

    control.setValue(-3);
    expect(mensajeEntero(control, 'el número de aves', { min: 0 })).toBe(
      'El número de aves no puede ser negativo.',
    );
  });

  it('detecta números de galpón repetidos', () => {
    const galpones = new FormArray(
      [
        new FormGroup({ numero: new FormControl(1) }),
        new FormGroup({ numero: new FormControl(1) }),
      ],
      { validators: [numerosUnicos()] },
    );
    expect(galpones.errors).toEqual({ numerosDuplicados: true });

    galpones.at(1).get('numero')?.setValue(2);
    expect(galpones.errors).toBeNull();
  });
});
