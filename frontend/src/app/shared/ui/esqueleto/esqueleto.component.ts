import { Component, computed, input } from '@angular/core';

/** Forma del esqueleto de carga. */
export type FormaEsqueleto = 'lineas' | 'tarjeta' | 'tabla';

/**
 * Esqueleto de carga: ocupa el lugar del contenido mientras llegan los datos,
 * para que la pantalla no «salte» (RNF05). Se anuncia como estado ocupado.
 */
@Component({
  selector: 'app-esqueleto',
  standalone: true,
  host: { class: 'block' },
  templateUrl: './esqueleto.component.html',
  styleUrl: './esqueleto.component.scss',
})
export class EsqueletoComponent {
  /** Forma que imita el contenido que va a llegar. */
  readonly forma = input<FormaEsqueleto>('lineas');

  /** Número de líneas o de filas. */
  readonly filas = input(3);

  protected readonly indices = computed(() =>
    Array.from({ length: Math.max(1, this.filas()) }, (_, indice) => indice),
  );

  /** Anchuras que alternan las líneas para parecerse a un texto real. */
  private static readonly ANCHOS = ['w-full', 'w-5/6', 'w-2/3'];

  protected ancho(indice: number): string {
    const anchos = EsqueletoComponent.ANCHOS;
    return anchos[indice % anchos.length];
  }
}
