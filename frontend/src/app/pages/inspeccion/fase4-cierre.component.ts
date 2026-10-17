import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  posicionEnEscala,
  tonoClasificacion,
  tonoPrioridad,
} from '../../core/inspeccion/cierre.modelos';
import type { InspeccionRespuesta } from '../../core/inspeccion/inspeccion.modelos';
import { AvisoComponent } from '../../shared/ui/aviso/aviso.component';
import {
  InsigniaComponent,
  type TonoInsignia,
} from '../../shared/ui/insignia/insignia.component';
import { TarjetaComponent } from '../../shared/ui/tarjeta/tarjeta.component';
import { FirmaActaComponent } from './firma-acta.component';

/**
 * Fase IV · Cierre y reportes (M7 · RF39–RF45).
 *
 * Muestra el resultado del cierre como en el wireframe de la página 7: la
 * calificación final con su escala (RF39), los aportes por grupo (RF35, RF39),
 * los indicadores a mejorar por prioridad (RF40), el plazo de los documentos
 * pendientes (RF43) y las acciones del acta: firmar (RF42), descargar (RF41),
 * enviar por correo (RF45) y volver a la Fase III para cargar documentos
 * (RF44). El componente no llama a la API: emite lo que el inspector pidió y
 * la página lo ejecuta, igual que las demás fases.
 */
@Component({
  selector: 'app-fase4-cierre',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    AvisoComponent,
    InsigniaComponent,
    TarjetaComponent,
  ],
  templateUrl: './fase4-cierre.component.html',
})
export class Fase4CierreComponent {
  private readonly dialogos = inject(MatDialog);

  /** Respuesta completa de la inspección, con el bloque del cierre. */
  readonly respuesta = input.required<InspeccionRespuesta>();
  /** Hay una operación en curso (firma, correo o descarga): bloquea botones. */
  readonly guardando = input(false);
  /** Hay conexión: el acta se firma, descarga y envía contra el servidor. */
  readonly enLinea = input(true);

  /** La página firma el acta con el PNG de la firma dibujada (RF42). */
  readonly firmar = output<string>();
  /** Envía el acta; sin destinatario usa el correo del responsable (RF45). */
  readonly enviar = output<string | undefined>();
  /** Descarga el acta vigente en PDF (RF41). */
  readonly descargar = output<void>();
  /** Vuelve a la Fase III para cargar los documentos pendientes (RF44). */
  readonly cargarDocumentos = output<void>();

  /** Destinatario puntual escrito por el inspector (opcional, RF45). */
  readonly destinatario = signal('');

  readonly fase4 = computed(() => this.respuesta().fase4);
  readonly acta = computed(() => this.fase4().acta);
  /** Posición del marcador en la escala de la calificación (0–100). */
  readonly marcador = computed(() => posicionEnEscala(this.fase4().final));
  readonly tonoNivel = computed<TonoInsignia>(() =>
    tonoClasificacion(this.fase4().clasificacion),
  );
  /** El número grande lleva el color del nivel (tokens de clasificación). */
  readonly claseNivel = computed(() => {
    switch (this.fase4().clasificacion) {
      case 'EXCELENTE':
        return 'text-nivel-excelente';
      case 'ALTO':
        return 'text-nivel-alto';
      case 'MEDIO':
        return 'text-nivel-medio';
      case 'BAJO':
        return 'text-nivel-bajo';
      default:
        return 'text-contenido';
    }
  });
  /** La calificación todavía cuenta los documentos pendientes como 0 (RF43). */
  readonly pendientesVigentes = computed(
    () => this.fase4().documentosPendientes > 0 && !this.fase4().vencido,
  );
  /** La visita ya tiene acta firmada (provisional o definitiva). */
  readonly tieneActa = computed(() => this.fase4().acta !== null);
  readonly vencimiento = computed<Date | null>(() => {
    const vencimiento = this.fase4().vencimiento;
    return vencimiento ? new Date(vencimiento) : null;
  });
  readonly tonoDe = tonoPrioridad;

  /** Abre el diálogo para dibujar la firma y emite el PNG al terminar. */
  abrirFirma(): void {
    this.dialogos
      .open(FirmaActaComponent, { width: '36rem', maxWidth: '95vw' })
      .afterClosed()
      .subscribe((firma?: string) => {
        if (firma) this.firmar.emit(firma);
      });
  }

  /** Pide el envío del acta con el destinatario escrito, si lo hay (RF45). */
  enviarCorreo(): void {
    const escrito = this.destinatario().trim();
    this.enviar.emit(escrito === '' ? undefined : escrito);
  }

  descargarActa(): void {
    this.descargar.emit();
  }

  irADocumentos(): void {
    this.cargarDocumentos.emit();
  }

  actualizarDestinatario(evento: Event): void {
    this.destinatario.set((evento.target as HTMLInputElement).value);
  }
}
