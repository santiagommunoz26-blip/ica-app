import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Estado vacío de una lista, tabla o panel: explica que no hay datos y, si
 * aplica, ofrece la acción siguiente por proyección de contenido.
 */
@Component({
  selector: 'app-estado-vacio',
  standalone: true,
  host: { class: 'block' },
  imports: [MatIconModule],
  templateUrl: './estado-vacio.component.html',
})
export class EstadoVacioComponent {
  /** Icono de Material que ilustra el estado. */
  readonly icono = input('inbox');

  /** Título breve. */
  readonly titulo = input.required<string>();

  /** Explicación de por qué está vacío. */
  readonly descripcion = input('');
}
