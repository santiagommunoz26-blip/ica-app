import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Tono de la insignia:
 * - `neutro`, `marca`, `acento`: usos generales.
 * - `exito`, `advertencia`, `peligro`: estados.
 * - `excelente`, `alto`, `medio`, `bajo`: clasificación del bienestar
 *   (metodología ICA v2.0).
 */
export type TonoInsignia =
  | 'neutro'
  | 'marca'
  | 'acento'
  | 'exito'
  | 'advertencia'
  | 'peligro'
  | 'excelente'
  | 'alto'
  | 'medio'
  | 'bajo';

/** Fondo y color de texto de cada tono (salen de los tokens de diseño). */
const CLASES: Record<TonoInsignia, string> = {
  neutro: 'bg-superficie-alterna text-contenido-suave',
  marca: 'bg-marca text-marca-contraste',
  acento: 'bg-acento text-acento-contraste',
  exito: 'bg-exito text-exito-contraste',
  advertencia: 'bg-advertencia text-advertencia-contraste',
  peligro: 'bg-peligro text-peligro-contraste',
  excelente: 'bg-nivel-excelente text-marca-contraste',
  alto: 'bg-nivel-alto text-marca-contraste',
  medio: 'bg-nivel-medio text-acento-contraste',
  bajo: 'bg-nivel-bajo text-contenido',
};

/**
 * Etiqueta corta de estado (estados de visita, roles, clasificación, etc.).
 * Se dibuja como píldora, igual que en los wireframes.
 */
@Component({
  selector: 'app-insignia',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './insignia.component.html',
  styleUrl: './insignia.component.scss',
})
export class InsigniaComponent {
  /** Tono (color) de la insignia. */
  readonly tono = input<TonoInsignia>('neutro');

  /** Icono opcional de Material, a la izquierda del texto. */
  readonly icono = input('');

  protected readonly clases = computed(() => CLASES[this.tono()]);
}
