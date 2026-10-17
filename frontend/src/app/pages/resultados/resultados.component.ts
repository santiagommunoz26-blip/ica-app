import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { VisitasService } from '../../core/visitas/visitas.service';
import type { Visita } from '../../core/visitas/visitas.modelos';
import { mensajeDeError } from '../../core/http/errores';
import {
  ModulosService,
  PUNTAJE_NO_APLICA_PREFIX,
  type CatalogoMetodologia,
  type FilaHistorial,
  type GrupoProductivo,
  type ResultadoVisita,
} from '../../core/modulos/modulos.service';
import { AvisoComponent, EncabezadoPaginaComponent } from '../../shared/ui';

const GRUPOS_PRODUCTIVOS: { id: GrupoProductivo; nombre: string }[] = [
  { id: 'PONEDORA_JAULA', nombre: 'Ponedora en jaula' },
  { id: 'PONEDORA_PISO_PASTOREO', nombre: 'Ponedora en piso y pastoreo' },
  { id: 'POLLO_ENGORDE', nombre: 'Pollo de engorde' },
  { id: 'TRASPATIO_PONEDORA', nombre: 'Traspatio · ponedora' },
  { id: 'TRASPATIO_POLLO', nombre: 'Traspatio · pollo de engorde' },
];

@Component({
  selector: 'app-resultados',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, AvisoComponent, EncabezadoPaginaComponent],
  templateUrl: './resultados.component.html',
})
export class ResultadosComponent implements OnInit {
  private readonly api = inject(ModulosService);
  private readonly visitasApi = inject(VisitasService);
  @ViewChild('firmaCanvas') private firmaCanvas?: ElementRef<HTMLCanvasElement>;

  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);
  readonly catalogo = signal<CatalogoMetodologia | null>(null);
  readonly historial = signal<FilaHistorial[]>([]);
  readonly visitasEnCurso = signal<Visita[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly visitaId = signal('');
  readonly grupoProductivo = signal<GrupoProductivo>('PONEDORA_JAULA');
  readonly gruposProductivos = GRUPOS_PRODUCTIVOS;
  grupoTieneIndicadores(grupo: GrupoProductivo): boolean {
    return this.catalogo()?.indicadores.some((item) => item.gruposProductivos.includes(grupo)) ?? false;
  }

  textoAportes(grupos: ResultadoVisita['grupos']): string {
    return grupos.map((grupo) => grupo.aporte.toFixed(2)).join(' / ');
  }
  puntajeDisponible(
    indicador: { escalaPuntaje: Record<'0' | '1' | '2', string> },
    puntaje: '0' | '1' | '2',
  ): boolean {
    return puntaje !== '1' ||
      !indicador.escalaPuntaje['1'].startsWith(PUNTAJE_NO_APLICA_PREFIX);
  }
  readonly puntajes = signal<Record<string, string | undefined>>({});
  readonly documentosPendientes = signal(false);
  readonly correoResponsable = signal('');
  readonly firmaLista = signal(false);
  readonly respuestasPendientes = signal<
    Partial<Record<string, Partial<Record<string, string>>>>
  >({});
  readonly predioComparar = signal('');
  readonly comparacion = signal<{
    visitaId: string;
    fecha: string;
    calificacion: number;
    clasificacion: string;
    grupos: ResultadoVisita['grupos'];
  }[]>([]);
  readonly indicadoresAplicables = computed(() => {
    const grupo = this.grupoProductivo();
    return (this.catalogo()?.indicadores ?? []).filter(
      (indicador) => indicador.activo && indicador.gruposProductivos.includes(grupo),
    );
  });
  readonly escalasSinVerificar = computed(() =>
    this.indicadoresAplicables().filter((indicador) =>
      (['0', '1', '2'] as const).some((puntaje) => {
        const texto = indicador.escalaPuntaje[puntaje];
        return !texto?.trim() ||
          (puntaje !== '1' && texto.startsWith(PUNTAJE_NO_APLICA_PREFIX)) ||
          /^Puntaje [012]\. Consultar criterio oficial/.test(texto);
      }),
    ),
  );
  readonly prediosComparables = computed(() => {
    const unicos = new Map<string, string>();
    for (const fila of this.historial()) {
      unicos.set(fila.visita.predio.id, fila.visita.predio.nombre);
    }
    return [...unicos].map(([id, nombre]) => ({ id, nombre }));
  });

  private dibujando = false;
  private tieneTrazos = false;

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [catalogo, historial, visitas] = await Promise.all([
        firstValueFrom(this.api.catalogo()),
        firstValueFrom(this.api.historial()),
        firstValueFrom(this.visitasApi.listar({ estado: 'EN_CURSO', porPagina: 100 })),
      ]);
      this.catalogo.set(catalogo);
      this.historial.set(historial);
      this.visitasEnCurso.set(visitas.datos);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  elegirVisita(id: string): void {
    this.visitaId.set(id);
    const visita = this.visitasEnCurso().find((item) => item.id === id);
    if (visita?.predio.tipoPredio === 'TRASPATIO') {
      this.grupoProductivo.set('TRASPATIO_PONEDORA');
    } else {
      this.grupoProductivo.set('PONEDORA_JAULA');
    }
    this.puntajes.set({});
    this.limpiarFirma();
  }

  cambiarGrupo(grupo: GrupoProductivo): void {
    this.grupoProductivo.set(grupo);
    this.puntajes.set({});
  }

  asignarPuntaje(id: string, event: Event): void {
    const puntaje = (event.target as HTMLSelectElement).value;
    this.puntajes.update((actual) => ({ ...actual, [id]: puntaje }));
  }

  comenzarFirma(event: PointerEvent): void {
    const canvas = this.firmaCanvas?.nativeElement;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const contexto = canvas.getContext('2d');
    if (!contexto) return;
    const { x, y } = this.coordenadas(canvas, event);
    contexto.beginPath();
    contexto.moveTo(x, y);
    contexto.lineWidth = 2;
    contexto.lineCap = 'round';
    contexto.strokeStyle = '#173f2b';
    this.dibujando = true;
  }

  dibujarFirma(event: PointerEvent): void {
    if (!this.dibujando || !this.firmaCanvas) return;
    const canvas = this.firmaCanvas.nativeElement;
    const contexto = canvas.getContext('2d');
    if (!contexto) return;
    const { x, y } = this.coordenadas(canvas, event);
    contexto.lineTo(x, y);
    contexto.stroke();
    this.tieneTrazos = true;
    this.firmaLista.set(true);
  }

  terminarFirma(): void {
    this.dibujando = false;
  }

  limpiarFirma(): void {
    const canvas = this.firmaCanvas?.nativeElement;
    const contexto = canvas?.getContext('2d');
    if (canvas && contexto) contexto.clearRect(0, 0, canvas.width, canvas.height);
    this.tieneTrazos = false;
    this.firmaLista.set(false);
  }

  private coordenadas(canvas: HTMLCanvasElement, event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  async cerrarVisita(): Promise<void> {
    const visitaId = this.visitaId();
    const indicadores = this.indicadoresAplicables();
    if (!visitaId) {
      this.error.set('Elija una visita en curso.');
      return;
    }
    if (this.escalasSinVerificar().length) {
      this.error.set('No se permite cerrar la visita hasta transcribir y verificar los criterios oficiales de escala en Administración > Metodología.');
      return;
    }
    if (!indicadores.length || indicadores.some((item) => this.puntajes()[item.id] === undefined)) {
      this.error.set('Registre un puntaje de 0, 1 o 2 para cada indicador aplicable.');
      return;
    }
    if (!this.tieneTrazos || !this.firmaCanvas) {
      this.error.set('El inspector debe firmar el acta en el recuadro.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    this.mensaje.set(null);
    try {
      const firmaBase64 = this.firmaCanvas.nativeElement.toDataURL('image/png');
      await firstValueFrom(this.api.cerrarVisita(visitaId, {
        grupoProductivo: this.grupoProductivo(),
        respuestas: indicadores.map((indicador) => ({
          indicadorId: indicador.id,
          puntaje: Number(this.puntajes()[indicador.id]),
        })),
        documentosPendientes: this.documentosPendientes(),
        correoResponsable: this.correoResponsable() || undefined,
        firmaBase64,
      }));
      this.mensaje.set('Visita cerrada y acta PDF generada.');
      this.visitaId.set('');
      await this.cargar();
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  async recibirDocumentos(fila: FilaHistorial): Promise<void> {
    this.error.set(null);
    try {
      const puntajes = this.respuestasPendientes()[fila.visita.id] ?? {};
      const respuestas = Object.entries(puntajes)
        .filter(([, puntaje]) => puntaje !== undefined)
        .map(([indicadorId, puntaje]) => ({
          indicadorId,
          puntaje: Number(puntaje),
        }));
      await firstValueFrom(this.api.recibirDocumentos(fila.visita.id, respuestas));
      this.mensaje.set('Documentos recibidos; se recalculó la calificación y se generó el acta definitiva.');
      await this.cargar();
    } catch (error) {
      this.error.set(mensajeDeError(error));
      await this.cargar();
    }
  }

  asignarPuntajeDocumento(visitaId: string, indicadorId: string, event: Event): void {
    const puntaje = (event.target as HTMLSelectElement).value;
    this.respuestasPendientes.update((actual) => ({
      ...actual,
      [visitaId]: {
        ...(actual[visitaId] ?? {}),
        [indicadorId]: puntaje,
      },
    }));
  }

  async enviarActa(fila: FilaHistorial): Promise<void> {
    this.error.set(null);
    try {
      const resultado = await firstValueFrom(this.api.enviarActa(fila.visita.id));
      this.mensaje.set(resultado.mensaje);
      await this.cargar();
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }

  async descargarActa(fila: FilaHistorial): Promise<void> {
    try {
      const blob = await firstValueFrom(this.api.descargarActa(fila.visita.id));
      this.descargar(blob, `acta-${fila.visita.id}.pdf`);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }

  async exportar(formato: 'csv' | 'xlsx' | 'pdf'): Promise<void> {
    try {
      const archivo = await firstValueFrom(this.api.descargarHistorial(formato));
      this.descargar(archivo, `historial-eba.${formato}`);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }

  async comparar(): Promise<void> {
    if (!this.predioComparar()) return;
    try {
      this.comparacion.set(await firstValueFrom(this.api.comparar(this.predioComparar())));
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }

  private descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);
  }
}
