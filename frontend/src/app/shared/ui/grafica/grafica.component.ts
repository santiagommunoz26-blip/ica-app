import {
  AfterViewInit,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  viewChild,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import { EstadoVacioComponent } from '../estado-vacio/estado-vacio.component';

// Solo se registran las piezas que se usan (línea, barras y dona): lo demás no
// viaja al paquete.
Chart.register(
  LineController,
  BarController,
  DoughnutController,
  LineElement,
  PointElement,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
);

/** Forma de la gráfica. */
export type TipoGrafica = 'linea' | 'barras' | 'dona';

/**
 * Gráfica de una sola serie (RF10).
 *
 * Los colores **no se escriben aquí**: se piden a los tokens de diseño por su
 * nombre (`marca`, `nivel-excelente`, …), así que cambiar la marca no obliga a
 * tocar componentes. Sin datos dibuja un estado vacío que explica por qué.
 */
@Component({
  selector: 'app-grafica',
  standalone: true,
  imports: [EstadoVacioComponent],
  templateUrl: './grafica.component.html',
  styleUrl: './grafica.component.scss',
})
export class GraficaComponent implements AfterViewInit {
  /** Tipo de gráfica. */
  readonly tipo = input<TipoGrafica>('barras');

  /** Etiquetas del eje o de la leyenda. */
  readonly etiquetas = input<string[]>([]);

  /** Valores; `null` deja el hueco sin pintar (meses sin resultado). */
  readonly valores = input<(number | null)[]>([]);

  /** Token del color de la serie (línea y barras). */
  readonly color = input('marca');

  /** Tokens de color por categoría (dona). */
  readonly colores = input<string[]>([]);

  /** Texto del centro (solo en la dona), como en el wireframe. */
  readonly textoCentro = input('');

  /** Sufijo de los valores en la información emergente. */
  readonly sufijo = input('');

  /** Tope del eje vertical (por ejemplo 100 para un puntaje). */
  readonly maximo = input<number | undefined>(undefined);

  /** Título de la gráfica (se usa como descripción para lectores de pantalla). */
  readonly titulo = input('');

  /** Mensaje del estado vacío. */
  readonly vacio = input('Todavía no hay datos para mostrar.');

  private readonly lienzo = viewChild<ElementRef<HTMLCanvasElement>>('lienzo');
  private grafica?: Chart;

  /** ¿Hay algún valor que pintar? */
  readonly hayDatos = computed(() =>
    this.valores().some((valor) => valor !== null && valor !== undefined),
  );

  constructor() {
    effect(() => {
      // Cualquier cambio en los datos redibuja la gráfica.
      this.tipo();
      this.etiquetas();
      this.valores();
      this.color();
      this.colores();
      this.maximo();
      this.dibujar();
    });
  }

  ngAfterViewInit(): void {
    this.dibujar();
  }

  private dibujar(): void {
    const canvas = this.lienzo()?.nativeElement;
    if (!canvas) return;

    this.grafica?.destroy();
    this.grafica = undefined;
    if (!this.hayDatos()) return;

    this.grafica = new Chart(canvas, this.configuracion());
  }

  private configuracion(): ChartConfiguration {
    const etiquetas = this.etiquetas();
    const valores = this.valores();
    const colorSerie = colorDeToken(this.color());
    const colorTexto = colorDeToken('texto-suave');
    const colorBorde = colorDeToken('borde');
    const sufijo = this.sufijo();

    const informacion = {
      backgroundColor: colorDeToken('marca-fuerte'),
      titleColor: colorDeToken('sobre-marca'),
      bodyColor: colorDeToken('sobre-marca'),
      padding: 10,
      callbacks: {
        label: (elemento: { parsed: unknown; label?: string }) => {
          const valor =
            typeof elemento.parsed === 'number'
              ? elemento.parsed
              : (elemento.parsed as { y?: number })?.y;
          return `${elemento.label ?? ''} ${valor ?? 0}${sufijo ? ` ${sufijo}` : ''}`.trim();
        },
      },
    };

    if (this.tipo() === 'dona') {
      const colores = this.colores();
      const dona: ChartConfiguration = {
        type: 'doughnut',
        data: {
          labels: etiquetas,
          datasets: [
            {
              data: valores.map((valor) => valor ?? 0),
              backgroundColor: etiquetas.map((_, indice) =>
                colorDeToken(colores[indice] ?? 'marca'),
              ),
              borderWidth: 0,
            },
          ],
        },
        // `cutout` es propio de la dona: el tipo general de la configuración no
        // lo declara, así que se afirma aquí.
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: { legend: { display: false }, tooltip: informacion },
        },
      } as ChartConfiguration;
      return dona;
    }

    if (this.tipo() === 'linea') {
      return {
        type: 'line',
        data: {
          labels: etiquetas,
          datasets: [
            {
              label: this.titulo(),
              data: valores,
              borderColor: colorSerie,
              backgroundColor: `${colorSerie}22`,
              pointBackgroundColor: colorSerie,
              pointRadius: 4,
              borderWidth: 2,
              tension: 0.35,
              // Los meses sin resultado dejan el hueco, no un cero.
              spanGaps: true,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: informacion },
          scales: {
            y: {
              beginAtZero: true,
              max: this.maximo(),
              grid: { color: colorBorde },
              ticks: { color: colorTexto },
            },
            x: { grid: { display: false }, ticks: { color: colorTexto } },
          },
        },
      };
    }

    return {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: [
          {
            label: this.titulo(),
            data: valores,
            backgroundColor: colorSerie,
            borderRadius: 8,
            maxBarThickness: 48,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: informacion },
        scales: {
          y: {
            beginAtZero: true,
            max: this.maximo(),
            grid: { color: colorBorde },
            ticks: { color: colorTexto },
          },
          x: { grid: { display: false }, ticks: { color: colorTexto } },
        },
      },
    };
  }
}

/**
 * Lee un token de diseño de las variables CSS de la aplicación.
 * El respaldo es un gris neutro: nunca un color de marca escrito a mano.
 */
function colorDeToken(nombre: string): string {
  if (typeof document === 'undefined') return 'rgba(0, 0, 0, 0.4)';
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${nombre}`)
    .trim();
  return valor || 'rgba(0, 0, 0, 0.4)';
}
