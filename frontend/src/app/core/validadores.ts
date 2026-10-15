import { AbstractControl, type ValidatorFn } from '@angular/forms';

/**
 * Valida que dos campos del mismo grupo tengan el mismo valor.
 * Se usa para confirmar la contraseña nueva.
 */
export function camposIguales(campoA: string, campoB: string): ValidatorFn {
  return (grupo: AbstractControl) => {
    const valorA = grupo.get(campoA)?.value as unknown;
    const valorB = grupo.get(campoB)?.value as unknown;
    return valorA === valorB ? null : { camposDistintos: true };
  };
}
