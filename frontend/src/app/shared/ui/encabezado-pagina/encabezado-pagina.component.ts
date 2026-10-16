import { Component, input } from '@angular/core';

/**
 * Encabezado de pantalla: título, descripción corta y acciones a la derecha.
 * Las acciones se proyectan con `<ng-content>`.
 */
@Component({
  selector: 'app-encabezado-pagina',
  standalone: true,
  host: { class: 'block' },
  templateUrl: './encabezado-pagina.component.html',
})
export class EncabezadoPaginaComponent {
  /** Título de la pantalla. */
  readonly titulo = input.required<string>();

  /** Frase breve que explica el propósito de la pantalla. */
  readonly descripcion = input('');
}
