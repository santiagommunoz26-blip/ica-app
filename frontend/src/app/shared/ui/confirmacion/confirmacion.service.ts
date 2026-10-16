import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import {
  DatosConfirmacion,
  DialogoConfirmacionComponent,
} from './dialogo-confirmacion.component';

/**
 * Pide confirmación antes de una acción delicada (inactivar un usuario,
 * cerrar una visita, borrar un registro…). Devuelve `true` solo si la persona
 * confirma.
 *
 * ```ts
 * if (await this.confirmacion.confirmar({ titulo: '…', mensaje: '…' })) {
 *   // continuar
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ConfirmacionService {
  private readonly dialogo = inject(MatDialog);

  async confirmar(datos: DatosConfirmacion): Promise<boolean> {
    const referencia = this.dialogo.open<
      DialogoConfirmacionComponent,
      DatosConfirmacion,
      boolean
    >(DialogoConfirmacionComponent, {
      data: datos,
      width: '28rem',
      maxWidth: '95vw',
      autoFocus: 'dialog',
      restoreFocus: true,
    });

    return (await firstValueFrom(referencia.afterClosed())) === true;
  }
}
