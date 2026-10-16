import { Component, computed, input } from '@angular/core';

/** Variante visual de la tarjeta. */
export type VarianteTarjeta = 'superficie' | 'realce' | 'marca';

/** Relleno del contenido. */
export type RellenoTarjeta = 'normal' | 'compacto' | 'ninguno';

const FONDOS: Record<VarianteTarjeta, string> = {
  superficie: 'bg-superficie border-borde text-contenido',
  realce: 'bg-superficie-alterna border-borde text-contenido',
  marca: 'bg-marca border-marca text-marca-contraste',
};

const RELLENOS: Record<RellenoTarjeta, string> = {
  normal: 'p-lg',
  compacto: 'p-md',
  ninguno: 'p-0',
};

/**
 * Tarjeta o sección contenedora con título y acciones opcionales.
 * Es el contenedor estándar de las pantallas (equivale a las tarjetas blancas
 * de los wireframes).
 */
@Component({
  selector: 'app-tarjeta',
  standalone: true,
  host: { class: 'block' },
  templateUrl: './tarjeta.component.html',
})
export class TarjetaComponent {
  /** Título de la sección. */
  readonly titulo = input('');

  /** Texto de apoyo bajo el título. */
  readonly descripcion = input('');

  /** Variante visual. */
  readonly variante = input<VarianteTarjeta>('superficie');

  /** Espacio interior del contenido. */
  readonly relleno = input<RellenoTarjeta>('normal');

  protected readonly clasesFondo = computed(() => FONDOS[this.variante()]);
  protected readonly clasesRelleno = computed(() => RELLENOS[this.relleno()]);
}
