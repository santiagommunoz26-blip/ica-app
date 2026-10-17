import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { mensajeDeError } from '../../core/http/errores';
import {
  ModulosService,
  PUNTAJE_NO_APLICA_PREFIX,
  type CatalogoMetodologia,
  type EventoAuditoria,
  type GrupoMedida,
  type GrupoProductivo,
  type IndicadorMetodologia,
  type TipoPredio,
  type VersionMetodologia,
} from '../../core/modulos/modulos.service';
import { AvisoComponent, EncabezadoPaginaComponent } from '../../shared/ui';

type BorradorIndicador = Omit<IndicadorMetodologia, 'id'>;
const GRUPOS: GrupoMedida[] = ['MBA', 'MBR', 'MBG'];
const PRODUCTIVOS: { clave: GrupoProductivo; etiqueta: string }[] = [
  { clave: 'PONEDORA_JAULA', etiqueta: 'Ponedora en jaula' },
  { clave: 'PONEDORA_PISO_PASTOREO', etiqueta: 'Ponedora en piso/pastoreo' },
  { clave: 'POLLO_ENGORDE', etiqueta: 'Pollo de engorde' },
  { clave: 'TRASPATIO_PONEDORA', etiqueta: 'Traspatio ponedora' },
  { clave: 'TRASPATIO_POLLO', etiqueta: 'Traspatio pollo' },
];

@Component({
  selector: 'app-metodologia',
  standalone: true,
  imports: [DatePipe, FormsModule, AvisoComponent, EncabezadoPaginaComponent],
  templateUrl: './metodologia.component.html',
})
export class MetodologiaComponent implements OnInit {
  private readonly api = inject(ModulosService);
  readonly catalogo = signal<CatalogoMetodologia | null>(null);
  readonly versiones = signal<VersionMetodologia[]>([]);
  readonly auditoria = signal<EventoAuditoria[]>([]);
  readonly error = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly editando = signal(false);
  readonly seleccionado = signal<string | null>(null);
  readonly grupos = GRUPOS;
  readonly puntajes: ('0' | '1' | '2')[] = ['0', '1', '2'];
  readonly productivos = PRODUCTIVOS;
  readonly tipos: TipoPredio[] = ['CORRAL', 'TRASPATIO'];
  tipoPesos: TipoPredio = 'CORRAL';
  draft: BorradorIndicador = this.nuevoBorrador();
  pesos: Record<GrupoMedida, number> = { MBA: 35, MBR: 35, MBG: 30 };

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    try {
      const [catalogo, versiones, auditoria] = await Promise.all([
        firstValueFrom(this.api.catalogo()),
        firstValueFrom(this.api.versiones()),
        firstValueFrom(this.api.auditoria()),
      ]);
      this.catalogo.set(catalogo);
      this.versiones.set(versiones);
      this.auditoria.set(auditoria);
      this.cargarPesos();
    } catch (error) {
      this.error.set(mensajeDeError(error));
    }
  }

  seleccionarTipo(tipo: TipoPredio): void {
    this.tipoPesos = tipo;
    this.cargarPesos();
  }

  private cargarPesos(): void {
    const pesos = this.catalogo()?.pesos.filter((item) => item.tipoPredio === this.tipoPesos) ?? [];
    this.pesos = {
      MBA: Number(pesos.find((item) => item.grupoMedida === 'MBA')?.porcentaje ?? 0),
      MBR: Number(pesos.find((item) => item.grupoMedida === 'MBR')?.porcentaje ?? 0),
      MBG: Number(pesos.find((item) => item.grupoMedida === 'MBG')?.porcentaje ?? 0),
    };
  }

  editar(indicador: IndicadorMetodologia): void {
    this.seleccionado.set(indicador.id);
    this.editando.set(true);
    this.draft = {
      clave: indicador.clave,
      nombre: indicador.nombre,
      grupoMedida: indicador.grupoMedida,
      metodoEvaluacion: indicador.metodoEvaluacion,
      gruposProductivos: [...indicador.gruposProductivos],
      referenciaManual: indicador.referenciaManual,
      escalaPuntaje: { ...indicador.escalaPuntaje },
      activo: indicador.activo,
    };
  }

  nuevo(): void {
    this.seleccionado.set(null);
    this.editando.set(true);
    this.draft = this.nuevoBorrador();
  }

  cancelar(): void {
    this.editando.set(false);
    this.seleccionado.set(null);
  }

  async guardarIndicador(): Promise<void> {
    this.error.set(null);
    this.mensaje.set(null);
    if (
      !this.draft.nombre.trim() ||
      !this.draft.gruposProductivos.length ||
      !this.draft.escalaPuntaje['0'].trim() ||
      !this.draft.escalaPuntaje['2'].trim() ||
      !this.draft.escalaPuntaje['1'].trim() ||
      (this.draft.escalaPuntaje['1'].startsWith(PUNTAJE_NO_APLICA_PREFIX) &&
        this.draft.escalaPuntaje['1'].trim().length <= PUNTAJE_NO_APLICA_PREFIX.length)
    ) {
      this.error.set('Complete el nombre, los grupos productivos y las escalas 0 y 2. Si el nivel 1 no está definido, márquelo como no aplicable.');
      return;
    }
    this.guardando.set(true);
    try {
      const id = this.seleccionado();
      const resultado = id
        ? await firstValueFrom(this.api.actualizarIndicador(id, this.draft))
        : await firstValueFrom(this.api.guardarIndicador(this.draft));
      this.catalogo.set(resultado);
      this.versiones.set(await firstValueFrom(this.api.versiones()));
      this.auditoria.set(await firstValueFrom(this.api.auditoria()));
      this.editando.set(false);
      this.seleccionado.set(null);
      this.mensaje.set('Cambio guardado en una nueva versión de la metodología.');
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  async guardarPesos(): Promise<void> {
    this.error.set(null);
    this.mensaje.set(null);
    const suma = GRUPOS.reduce((total, grupo) => total + Number(this.pesos[grupo]), 0);
    if (Math.round(suma * 100) !== 10_000 || GRUPOS.some((grupo) => this.pesos[grupo] < 0 || this.pesos[grupo] > 100)) {
      this.error.set('Los pesos deben sumar exactamente 100 % y cada valor estar entre 0 y 100.');
      return;
    }
    this.guardando.set(true);
    try {
      const resultado = await firstValueFrom(
        this.api.guardarPesos(this.tipoPesos, GRUPOS.map((grupo) => ({
          grupoMedida: grupo,
          porcentaje: Number(this.pesos[grupo]),
        }))),
      );
      this.catalogo.set(resultado);
      this.versiones.set(await firstValueFrom(this.api.versiones()));
      this.auditoria.set(await firstValueFrom(this.api.auditoria()));
      this.mensaje.set('Pesos guardados en una nueva versión de la metodología.');
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  detalleAuditoria(evento: EventoAuditoria): string {
    return JSON.stringify(evento.detalle);
  }

  mostrarCriterio(criterio: string): string {
    return criterio.startsWith(PUNTAJE_NO_APLICA_PREFIX)
      ? `No aplicable. ${criterio.slice(PUNTAJE_NO_APLICA_PREFIX.length).trim()}`
      : criterio;
  }

  marcarPuntajeUnoNoAplicable(): void {
    this.draft.escalaPuntaje['1'] =
      `${PUNTAJE_NO_APLICA_PREFIX} Este indicador solo permite puntajes 0 y 2.`;
  }

  private nuevoBorrador(): BorradorIndicador {
    return {
      clave: '',
      nombre: '',
      grupoMedida: 'MBR',
      metodoEvaluacion: 'Inspección visual con muestreo',
      gruposProductivos: [],
      referenciaManual: 'ICA EBA v2.0 (2024)',
      escalaPuntaje: {
        '0': '',
        '1': '',
        '2': '',
      },
      activo: true,
    };
  }
}
