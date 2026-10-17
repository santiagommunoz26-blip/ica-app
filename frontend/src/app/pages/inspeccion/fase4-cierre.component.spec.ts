import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import type { CalculoGrupo } from '../../core/inspeccion/calculo.modelos';
import {
  type ActaResumen,
  type Fase4,
  type IndicadorMejora,
} from '../../core/inspeccion/cierre.modelos';
import type { InspeccionRespuesta } from '../../core/inspeccion/inspeccion.modelos';
import { Fase4CierreComponent } from './fase4-cierre.component';
import { FirmaActaComponent } from './firma-acta.component';

/** Firma que devuelve el diálogo en las pruebas (RF42). */
const FIRMA = `data:image/png;base64,${'A'.repeat(64)}`;

/** Renglón de indicador a mejorar de prueba (RF40). */
function fila(
  parcial: Partial<IndicadorMejora> & { codigo: string },
): IndicadorMejora {
  return {
    nombre: `Indicador ${parcial.codigo}`,
    grupo: 'MBA',
    etiquetaGrupo: 'Animal (MBA)',
    valor: 100,
    pendiente: false,
    prioridad: 'SIN_PRIORIDAD',
    etiquetaPrioridad: 'Sin prioridad',
    ...parcial,
  };
}

/** Aportes de los tres grupos de medidas (RF35, RF39). */
const GRUPOS: CalculoGrupo[] = [
  {
    grupo: 'MBA',
    etiqueta: 'Animal (MBA)',
    peso: 40,
    indicadoresConValor: 3,
    indicadoresTotal: 3,
    promedio: 94.44,
    aporte: 37.78,
  },
  {
    grupo: 'MBR',
    etiqueta: 'Recursos (MBR)',
    peso: 35,
    indicadoresConValor: 4,
    indicadoresTotal: 4,
    promedio: 100,
    aporte: 35,
  },
  {
    grupo: 'MBG',
    etiqueta: 'Gestión (MBG)',
    peso: 25,
    indicadoresConValor: 9,
    indicadoresTotal: 9,
    promedio: 93.33,
    aporte: 23.33,
  },
];

/** Acta de prueba (RF41–RF45). */
function acta(parcial: Partial<ActaResumen> = {}): ActaResumen {
  return {
    id: 'acta-1',
    version: 1,
    definitiva: false,
    firmadaEn: '2026-10-16T15:30:00.000Z',
    firmadaPorNombre: 'Ana Ruiz',
    documentosPendientes: 0,
    vencimientoDocumentos: null,
    calificacion: 96.11,
    clasificacion: 'EXCELENTE',
    etiquetaClasificacion: 'Excelente',
    correoEnviadoEn: null,
    correoDestinatario: null,
    tamano: 48_000,
    huella: 'a'.repeat(64),
    ...parcial,
  };
}

/** Bloque del cierre con lo que pida cada prueba. */
function fase4De(parciales: Partial<Fase4> = {}): Fase4 {
  return {
    completo: true,
    indicadoresSinEvaluar: 0,
    indicadores: [],
    final: 96.11,
    clasificacion: 'EXCELENTE',
    etiquetaClasificacion: 'Excelente',
    grupos: GRUPOS,
    documentosPendientes: 0,
    vencimiento: null,
    vencido: false,
    acta: null,
    puedeEmitir: true,
    motivoNoEmitir: null,
    ...parciales,
  };
}

/**
 * Respuesta de la inspección: la Fase IV solo usa su propio bloque y el
 * correo del predio, así que el resto va mínimo.
 */
function crearInspeccion(
  fase4: Fase4,
  correoResponsable: string | null = null,
): InspeccionRespuesta {
  return {
    visita: {
      id: 'visita-1',
      estado: 'EN_CURSO',
      etiquetaEstado: 'En curso',
      programadaPara: '2026-10-20T14:00:00.000Z',
      inspector: 'Ana Ruiz',
    },
    predio: {
      id: 'predio-1',
      nombre: 'Granja El Rosal',
      municipio: 'Sopó',
      vereda: 'Vereda 1',
      responsable: 'Don José',
      correoResponsable,
      numeroAves: 60000,
      sistemaProduccion: 'PISO',
      etiquetaSistemaProduccion: 'Piso',
      tipoPredio: 'CORRAL',
      etiquetaTipoPredio: 'Granja (corral)',
    },
    fase4,
  } as InspeccionRespuesta;
}

/** Cierre y actas, Fase IV (M7 · RF39–RF45). */
describe('Fase4CierreComponent', () => {
  let fixture: ComponentFixture<Fase4CierreComponent>;
  let componente: Fase4CierreComponent;
  let dialogos: jasmine.SpyObj<MatDialog>;

  const texto = () =>
    ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(
      /\s+/g,
      ' ',
    );

  /** Botón cuyo texto contiene lo indicado. */
  function boton(etiqueta: string): HTMLButtonElement {
    const botones = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    );
    const encontrado = botones.find((boton) =>
      (boton.textContent ?? '').includes(etiqueta),
    );
    if (!encontrado) {
      throw new Error(`No se encontró el botón «${etiqueta}».`);
    }
    return encontrado;
  }

  /** ¿Existe un botón cuyo texto contiene lo indicado? */
  function botonEsta(etiqueta: string): boolean {
    const botones = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    );
    return botones.some((boton) =>
      (boton.textContent ?? '').includes(etiqueta),
    );
  }

  /** Lo que devuelve el diálogo de firma al cerrarse. */
  function cuandoFirmaDevuelve(firma: string | undefined): void {
    dialogos.open.and.returnValue({
      afterClosed: () => of(firma),
    } as unknown as ReturnType<MatDialog['open']>);
  }

  async function configurar(
    fase4: Fase4,
    opciones: { correo?: string | null; enLinea?: boolean } = {},
  ): Promise<void> {
    dialogos = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    cuandoFirmaDevuelve(FIRMA);

    await TestBed.configureTestingModule({
      imports: [Fase4CierreComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialog, useValue: dialogos },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Fase4CierreComponent);
    fixture.componentRef.setInput(
      'respuesta',
      crearInspeccion(fase4, opciones.correo ?? null),
    );
    if (opciones.enLinea !== undefined) {
      fixture.componentRef.setInput('enLinea', opciones.enLinea);
    }
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('muestra la calificación, la escala y los aportes (RF39)', async () => {
    await configurar(fase4De());

    expect(texto()).toContain('Calificación final');
    expect(texto()).toContain('96.1 %');
    expect(texto()).toContain('NIVEL EXCELENTE');
    expect(texto()).toContain('Bajo');
    expect(componente.marcador()).toBe(96.11);

    // Aporte por grupo: promedio × peso = aporte (RF35, RF39).
    expect(texto()).toContain('Aporte por grupo de medidas');
    expect(texto()).toContain('94.4 % × 40 % = 37.8');
    expect(texto()).toContain('Animal (MBA)');
  });

  it('lista los indicadores a mejorar con su prioridad (RF40)', async () => {
    const alta = fila({
      codigo: 'MBA-01',
      valor: 58,
      prioridad: 'ALTA',
      etiquetaPrioridad: 'Prioridad alta',
    });
    const media = fila({
      codigo: 'MBR-02',
      grupo: 'MBR',
      etiquetaGrupo: 'Recursos (MBR)',
      valor: 75,
      prioridad: 'MEDIA',
      etiquetaPrioridad: 'Prioridad media',
    });
    const pendiente = fila({
      codigo: 'MBG-09',
      grupo: 'MBG',
      etiquetaGrupo: 'Gestión (MBG)',
      valor: 0,
      pendiente: true,
      prioridad: 'ALTA',
      etiquetaPrioridad: 'Prioridad alta',
    });
    const sin = fila({
      codigo: 'MBG-01',
      grupo: 'MBG',
      etiquetaGrupo: 'Gestión (MBG)',
      valor: 100,
    });
    await configurar(fase4De({ indicadores: [pendiente, alta, media, sin] }));

    expect(texto()).toContain('Indicadores a mejorar');
    expect(texto()).toContain('Indicador MBA-01');
    expect(texto()).toContain('Prioridad media');
    expect(texto()).toContain('58 %');
    expect(texto()).toContain('Pendiente');
    expect(texto()).toContain('Sin prioridad');

    // Cada fila lleva el tono de su prioridad (o el de pendiente).
    expect(componente.tonoDe(alta)).toBe('peligro');
    expect(componente.tonoDe(media)).toBe('advertencia');
    expect(componente.tonoDe(pendiente)).toBe('advertencia');
    expect(componente.tonoDe(sin)).toBe('acento');
  });

  it('firma el acta con el PNG dibujado (RF42)', async () => {
    await configurar(fase4De());

    const emitidas: string[] = [];
    componente.firmar.subscribe((firma) => emitidas.push(firma));

    boton('Firmar y generar acta PDF').click();
    fixture.detectChanges();

    expect(dialogos.open).toHaveBeenCalledTimes(1);
    expect(dialogos.open).toHaveBeenCalledWith(
      FirmaActaComponent,
      jasmine.anything(),
    );
    expect(emitidas).toEqual([FIRMA]);
  });

  it('no deja firmar sin el cálculo completo y explica por qué (RF41)', async () => {
    await configurar(
      fase4De({
        completo: false,
        indicadoresSinEvaluar: 3,
        puedeEmitir: false,
        motivoNoEmitir:
          'Todavía faltan indicadores sin evaluar: complete las fases para poder firmar el acta.',
      }),
    );

    expect(texto()).toContain('Faltan 3 indicadores sin evaluar');
    expect(texto()).toContain('complete las fases');
    expect(botonEsta('Firmar')).toBeFalse();
  });

  it('con pendientes y sin acta explica cuándo corre el plazo (RF43)', async () => {
    await configurar(fase4De({ documentosPendientes: 1 }));

    expect(texto()).toContain('Documentos pendientes: 1');
    expect(texto()).toContain('Al firmar, el acta queda provisional');
    expect(texto()).not.toContain('Vence el');
  });

  it('con acta provisional muestra el vencimiento del plazo (RF43)', async () => {
    await configurar(
      fase4De({
        documentosPendientes: 2,
        vencimiento: '2026-10-20T22:00:00.000Z',
        acta: acta({
          documentosPendientes: 2,
          vencimientoDocumentos: '2026-10-20T22:00:00.000Z',
        }),
        puedeEmitir: false,
        motivoNoEmitir:
          'Aún hay documentos pendientes: entréguelos antes del vencimiento para recalcular y emitir el acta definitiva (RF44).',
      }),
    );

    expect(texto()).toContain('Documentos pendientes: 2');
    expect(texto()).toContain('Plazo: 1 día hábil');
    expect(texto()).toContain('Vence el');
    expect(texto()).toContain('cuentan como 0 %');
  });

  it('con el plazo vencido ya no hay tarjeta de pendientes (RF44)', async () => {
    await configurar(
      fase4De({
        documentosPendientes: 1,
        vencimiento: '2026-10-15T22:00:00.000Z',
        vencido: true,
        puedeEmitir: false,
        motivoNoEmitir:
          'La visita ya tiene acta definitiva: no se modifica ni se reemplaza (RNF10).',
      }),
    );

    expect(texto()).not.toContain('Documentos pendientes:');
    expect(texto()).toContain('acta definitiva');
  });

  it('muestra el acta firmada y permite descargarla y enviarla (RF41, RF45)', async () => {
    await configurar(
      fase4De({
        acta: acta({ definitiva: true, version: 2, correoDestinatario: null }),
        puedeEmitir: false,
        motivoNoEmitir:
          'La visita ya tiene acta definitiva: no se modifica ni se reemplaza (RNF10).',
      }),
      { correo: 'responsable@ica.local' },
    );

    expect(texto()).toContain('Definitiva');
    expect(texto()).toContain('Acta v2');
    expect(texto()).toContain('Firmada por Ana Ruiz');

    const descargas: number[] = [];
    componente.descargar.subscribe(() => descargas.push(1));
    boton('Descargar acta PDF').click();
    expect(descargas.length).toBe(1);

    // Sin destinatario escrito se usa el correo del responsable (RF45).
    const enviados: (string | undefined)[] = [];
    componente.enviar.subscribe((destinatario) => enviados.push(destinatario));
    boton('Enviar correo').click();
    expect(enviados).toEqual([undefined]);

    // Con otro destinatario, se respeta lo escrito (RF45).
    componente.destinatario.set('otro@ica.local');
    boton('Enviar correo').click();
    expect(enviados).toEqual([undefined, 'otro@ica.local']);

    // El acta definitiva no se vuelve a firmar (RNF10).
    expect(botonEsta('Firmar')).toBeFalse();
  });

  it('vuelve a la Fase III para cargar documentos (RF44)', async () => {
    await configurar(fase4De());

    const avisos: number[] = [];
    componente.cargarDocumentos.subscribe(() => avisos.push(1));
    boton('Cargar docs').click();
    expect(avisos.length).toBe(1);
  });

  it('sin conexión no deja firmar y lo explica (RF42)', async () => {
    await configurar(fase4De(), { enLinea: false });

    expect(texto()).toContain('Sin conexión');
    expect(boton('Firmar y generar acta PDF').disabled).toBeTrue();
  });

  it('sin conexión tampoco deja descargar ni enviar el acta (RF41, RF45)', async () => {
    await configurar(fase4De({ acta: acta() }), { enLinea: false });

    expect(boton('Descargar acta PDF').disabled).toBeTrue();
    expect(boton('Enviar correo').disabled).toBeTrue();
  });
});
