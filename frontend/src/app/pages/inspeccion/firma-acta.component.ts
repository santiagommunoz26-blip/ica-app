import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AvisoComponent } from '../../shared/ui/aviso/aviso.component';

/**
 * Diálogo para dibujar la firma del inspector (M7 · RF42).
 *
 * La firma se dibuja con el dedo o el ratón sobre un lienzo y se devuelve como
 * imagen PNG en datos (data URL). El servidor la valida y la estampa en el acta
 * (RF42); aquí solo se dibuja. Abrir con `MatDialog` desde la pestaña de
 * cierre: al cerrarse, `afterClosed` entrega el data URL o `undefined` si se
 * canceló.
 */
@Component({
  selector: 'app-firma-acta',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, AvisoComponent],
  templateUrl: './firma-acta.component.html',
})
export class FirmaActaComponent implements AfterViewInit {
  private readonly referencia = inject(MatDialogRef<FirmaActaComponent>);
  private readonly lienzo =
    viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');

  /** Ya se dibujó algo: habilita el botón de firmar. */
  readonly hayTrazo = signal(false);
  /** Problema del navegador o de la firma, mostrado con el aviso. */
  readonly error = signal<string | null>(null);

  private contexto: CanvasRenderingContext2D | null = null;
  private dibujando = false;

  ngAfterViewInit(): void {
    this.prepararLienzo();
  }

  /** Prepara el lienzo con la densidad de la pantalla para que salga nítido. */
  private prepararLienzo(): void {
    const lienzo = this.lienzo().nativeElement;
    const contexto = lienzo.getContext('2d');
    if (!contexto) {
      this.error.set(
        'Este navegador no permite dibujar la firma; use otro para firmar el acta.',
      );
      return;
    }
    const densidad = window.devicePixelRatio || 1;
    lienzo.width = Math.max(1, Math.round(lienzo.clientWidth * densidad));
    lienzo.height = Math.max(1, Math.round(lienzo.clientHeight * densidad));
    contexto.scale(densidad, densidad);
    contexto.lineWidth = 2;
    contexto.lineCap = 'round';
    contexto.lineJoin = 'round';
    // La tinta es el color del texto del tema (token de diseño), no un color
    // elegido a mano.
    const tinta = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-texto')
      .trim();
    contexto.strokeStyle = tinta || 'currentColor';
    this.contexto = contexto;
  }

  /** Arranca un trazo en el punto donde se apoyó el dedo o el ratón. */
  iniciar(evento: PointerEvent): void {
    if (!this.contexto) return;
    this.dibujando = true;
    this.error.set(null);
    (evento.currentTarget as HTMLElement | null)?.setPointerCapture?.(
      evento.pointerId,
    );
    this.contexto.beginPath();
    this.contexto.moveTo(evento.offsetX, evento.offsetY);
  }

  /** Continúa el trazo mientras el dedo o el ratón se mueve. */
  mover(evento: PointerEvent): void {
    if (!this.dibujando || !this.contexto) return;
    this.contexto.lineTo(evento.offsetX, evento.offsetY);
    this.contexto.stroke();
    this.hayTrazo.set(true);
  }

  /** Termina el trazo actual (al levantar el dedo o salir del lienzo). */
  terminar(): void {
    this.dibujando = false;
  }

  /** Borra la firma para volver a dibujarla. */
  limpiar(): void {
    const lienzo = this.lienzo().nativeElement;
    this.contexto?.clearRect(0, 0, lienzo.width, lienzo.height);
    this.hayTrazo.set(false);
    this.error.set(null);
  }

  /** Cierra el diálogo con la firma en PNG (RF42). */
  firmar(): void {
    if (!this.hayTrazo()) {
      this.error.set('Dibuje su firma antes de continuar.');
      return;
    }
    this.referencia.close(this.lienzo().nativeElement.toDataURL('image/png'));
  }

  /** Cierra el diálogo sin firmar. */
  cancelar(): void {
    this.referencia.close();
  }
}
