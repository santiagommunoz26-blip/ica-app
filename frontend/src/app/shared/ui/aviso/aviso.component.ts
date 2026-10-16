import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Tipo de aviso: determina color, icono y rol de accesibilidad. */
export type TipoAviso = 'info' | 'exito' | 'advertencia' | 'peligro';

/** Clases de color y icono de cada tipo (salen de los tokens de diseño). */
const ESTILOS: Record<TipoAviso, { clases: string; icono: string }> = {
  info: {
    clases: 'border-marca-suave bg-info-suave text-marca',
    icono: 'info',
  },
  exito: {
    clases: 'border-exito bg-exito-suave text-exito',
    icono: 'check_circle',
  },
  advertencia: {
    clases: 'border-advertencia bg-advertencia-suave text-advertencia-texto',
    icono: 'warning',
  },
  peligro: {
    clases: 'border-peligro bg-peligro-suave text-peligro',
    icono: 'error_outline',
  },
};

/**
 * Banda de aviso reutilizable (informativo, éxito, advertencia o error).
 * Se usa para mensajes dentro de una pantalla; para notificaciones flotantes
 * existe `NotificacionService`.
 */
@Component({
  selector: 'app-aviso',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './aviso.component.html',
  styleUrl: './aviso.component.scss',
})
export class AvisoComponent {
  /** Tono del aviso. */
  readonly tipo = input<TipoAviso>('info');

  /** Título opcional en negrita. */
  readonly titulo = input('');

  /** Icono de Material; si se omite se usa el del tipo. */
  readonly icono = input('');

  private readonly estilo = computed(() => ESTILOS[this.tipo()]);

  protected readonly clases = computed(() => this.estilo().clases);
  protected readonly iconoFinal = computed(
    () => this.icono() || this.estilo().icono,
  );
  /** Los errores se anuncian de inmediato; el resto, como estado. */
  protected readonly rol = computed(() =>
    this.tipo() === 'peligro' ? 'alert' : 'status',
  );
}
