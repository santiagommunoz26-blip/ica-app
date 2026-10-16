import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

/** Datos que recibe el diálogo de confirmación. */
export interface DatosConfirmacion {
  /** Pregunta o título del diálogo. */
  titulo: string;
  /** Explicación de la consecuencia de la acción. */
  mensaje: string;
  /** Texto del botón que confirma (por defecto «Confirmar»). */
  textoConfirmar?: string;
  /** Texto del botón que cancela (por defecto «Cancelar»). */
  textoCancelar?: string;
  /** Marca la acción como destructiva (botón en rojo). */
  peligroso?: boolean;
}

/**
 * Diálogo reutilizable de confirmación. Se abre con `ConfirmacionService`,
 * no directamente, para que todas las confirmaciones se vean igual.
 */
@Component({
  selector: 'app-dialogo-confirmacion',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './dialogo-confirmacion.component.html',
})
export class DialogoConfirmacionComponent {
  protected readonly datos = inject<DatosConfirmacion>(MAT_DIALOG_DATA);
}
