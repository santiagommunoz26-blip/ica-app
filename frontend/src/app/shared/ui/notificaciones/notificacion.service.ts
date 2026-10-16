import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Tono de la notificación. */
export type TipoNotificacion = 'info' | 'exito' | 'advertencia' | 'peligro';

/**
 * Notificaciones flotantes uniformes (guardado correcto, error de red, etc.).
 * Se dibujan en la parte inferior central y se anuncian a los lectores de
 * pantalla (`aria-live`), para que el resultado de una acción nunca pase
 * desapercibido (RNF13–RNF16).
 */
@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly snackBar = inject(MatSnackBar);

  /** Informa que una acción terminó bien. */
  exito(mensaje: string, duracion = 4000): void {
    this.mostrar(mensaje, 'exito', duracion);
  }

  /** Informa un error (por ejemplo, fallo de red o de validación del servidor). */
  error(mensaje: string, duracion = 6000): void {
    this.mostrar(mensaje, 'peligro', duracion);
  }

  /** Advierte sobre algo que conviene revisar. */
  advertencia(mensaje: string, duracion = 5000): void {
    this.mostrar(mensaje, 'advertencia', duracion);
  }

  /** Mensaje neutro o de contexto. */
  info(mensaje: string, duracion = 4000): void {
    this.mostrar(mensaje, 'info', duracion);
  }

  private mostrar(
    mensaje: string,
    tipo: TipoNotificacion,
    duracion: number,
  ): void {
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: duracion,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      // Las clases `aviso-snack-*` son globales y usan los tokens de diseño.
      panelClass: `aviso-snack-${tipo}`,
    });
  }
}
