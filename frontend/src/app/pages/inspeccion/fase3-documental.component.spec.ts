import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { calculoVacio } from '../../core/inspeccion/calculo.modelos';
import { fase4Vacia } from '../../core/inspeccion/cierre.modelos';
import {
  reglasFase3,
  type DocumentoEvaluado,
  type DocumentoRespuesta,
} from '../../core/inspeccion/fase3.modelos';
import type {
  Catalogo,
  IndicadorCatalogo,
  InspeccionRespuesta,
} from '../../core/inspeccion/inspeccion.modelos';
import { Fase3DocumentalComponent } from './fase3-documental.component';

const VISITA_ID = 'visita-1';

/** Indicador de gestión de prueba (RF27). */
function indicador(
  codigo: string,
  nombre: string,
  extra: Partial<IndicadorCatalogo> = {},
): IndicadorCatalogo {
  return {
    codigo,
    nombre,
    grupo: 'MBG',
    etiquetaGrupo: 'Gestión (MBG)',
    metodo: null,
    orden: Number(codigo.split('-')[1]),
    escalaMin: 0,
    escalaMax: 2,
    escalaDescripciones: [
      'No cumple o no presentó',
      'Cumple parcial',
      'Cumple completo',
    ],
    tipoMuestreo: 'PUNTOS_9',
    pregunta: null,
    tipoEvaluacion: 'PUNTAJE',
    escalaRangos: null,
    exigeFirmaProfesional: false,
    gruposProductivos: ['POLLO_ENGORDE', 'PONEDORA_PISO', 'PONEDORA_JAULA'],
    ...extra,
  };
}

/** Documento guardado, como lo devuelve el servidor (RF27–RF31). */
function documento(
  indicadorCodigo: string,
  extra: Partial<DocumentoRespuesta> = {},
): DocumentoRespuesta {
  return {
    indicadorCodigo,
    presentado: null,
    legible: false,
    firmadoResponsable: false,
    firmadoProfesional: null,
    mortalidad: null,
    puntaje: null,
    pendiente: false,
    guardadoEn: '2026-10-16T10:00:00.000Z',
    verificado: false,
    ...extra,
  };
}

const CATALOGO: Catalogo = {
  version: '2.0',
  anio: 2024,
  vigenteDesde: '2024-01-01',
  provisional: true,
  nota: null,
  pesosCorral: [],
  pesosTraspatio: [],
  gruposProductivos: [
    { codigo: 'POLLO_ENGORDE', etiqueta: 'Pollo de engorde' },
    { codigo: 'PONEDORA_PISO', etiqueta: 'Ponedora en piso o pastoreo' },
    { codigo: 'PONEDORA_JAULA', etiqueta: 'Ponedora en jaula' },
  ],
  sistemasProduccion: [],
  indicadores: [
    indicador('MBG-01', 'Calidad del agua'),
    indicador('MBG-04', 'POE de bienestar animal', {
      exigeFirmaProfesional: true,
    }),
    indicador('MBG-09', 'Mortalidad (5 ciclos)', {
      tipoEvaluacion: 'MORTALIDAD',
      // Los rangos de RF30 viven en el catálogo (RF38).
      escalaRangos: {
        POLLO_ENGORDE: [
          { puntaje: 2, max: 6 },
          { puntaje: 1, max: 9 },
          { puntaje: 0, max: null },
        ],
        PONEDORA_PISO: [
          { puntaje: 2, max: 12 },
          { puntaje: 1, max: 14 },
          { puntaje: 0, max: null },
        ],
        PONEDORA_JAULA: [
          { puntaje: 2, max: 12 },
          { puntaje: 1, max: 14 },
          { puntaje: 0, max: null },
        ],
      },
    }),
    {
      ...indicador('MBA-01', 'Indicador del animal 1'),
      grupo: 'MBA',
      etiquetaGrupo: 'Animal (MBA)',
    },
  ],
  aplicables: {
    POLLO_ENGORDE: ['MBG-01', 'MBG-04', 'MBG-09', 'MBA-01'],
    PONEDORA_PISO: ['MBG-01', 'MBG-04', 'MBG-09', 'MBA-01'],
    PONEDORA_JAULA: ['MBG-01', 'MBG-04', 'MBG-09', 'MBA-01'],
  },
};

/** Respuesta de la inspección, con la Fase I ya guardada. */
function crearInspeccion(
  tipoPredio: 'CORRAL' | 'TRASPATIO' = 'CORRAL',
  documentos: DocumentoRespuesta[] = [],
): InspeccionRespuesta {
  return {
    visita: {
      id: VISITA_ID,
      estado: 'PROGRAMADA',
      etiquetaEstado: 'Programada',
      programadaPara: '2026-10-20T14:00:00.000Z',
      inspector: 'Ana Ruiz',
    },
    predio: {
      id: 'predio-1',
      nombre: 'Granja El Rosal',
      municipio: 'Sopó',
      vereda: 'Vereda 1',
      responsable: null,
      correoResponsable: null,
      numeroAves: tipoPredio === 'CORRAL' ? 60000 : 150,
      sistemaProduccion: null,
      etiquetaSistemaProduccion: null,
      tipoPredio,
      etiquetaTipoPredio:
        tipoPredio === 'CORRAL' ? 'Granja (corral)' : 'Traspatio',
    },
    ficha: {
      grupoProductivo: 'POLLO_ENGORDE',
      etiquetaGrupoProductivo: 'Pollo de engorde',
      fechaHora: null,
      observaciones: null,
      tipoPredio,
      etiquetaTipoPredio:
        tipoPredio === 'CORRAL' ? 'Granja (corral)' : 'Traspatio',
      pesos: [],
      galponesSugeridos: 1,
      guardada: true,
    },
    galpones: [],
    catalogo: CATALOGO,
    fase2: {
      reglas: {
        puntos: 9,
        hojasCentinelaMinimo: 3,
        jaula: false,
        avesMin: 15,
        avesMax: 30,
        jaulasMin: null,
        jaulasMax: null,
      },
      evaluaciones: [],
      evidencias: [],
      avance: [],
    },
    fase3: {
      reglas: reglasFase3(tipoPredio, 'POLLO_ENGORDE'),
      documentos,
      avance: {
        verificados: documentos.filter(
          (fila) => fila.puntaje !== null || fila.pendiente,
        ).length,
        total: 3,
      },
    },
    calculo: calculoVacio(),
    fase4: fase4Vacia(),
  };
}

/** Evento de un campo, como el que llega del formulario. */
const evento = (valor: string) =>
  ({ target: { value: valor } }) as unknown as Event;

/** Inspección documental, Fase III (M5 · RF27–RF33). */
describe('Fase3DocumentalComponent', () => {
  let fixture: ComponentFixture<Fase3DocumentalComponent>;
  let componente: Fase3DocumentalComponent;

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function configurar(respuesta: InspeccionRespuesta): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Fase3DocumentalComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(Fase3DocumentalComponent);
    fixture.componentRef.setInput('respuesta', respuesta);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    // El efecto siembra el estado en el primer chequeo; este segundo vuelve a
    // pintar con lo sembrado.
    fixture.detectChanges();
  }

  /** Documentos emitidos por la salida `guardar`. */
  function escucharGuardados(): DocumentoEvaluado[][] {
    const emitidos: DocumentoEvaluado[][] = [];
    componente.guardar.subscribe((documentos) => emitidos.push(documentos));
    return emitidos;
  }

  describe('con pollo de engorde', () => {
    it('carga lo guardado y muestra el avance de la lista (RF24, RF27)', async () => {
      await configurar(
        crearInspeccion('CORRAL', [
          documento('MBG-01', {
            presentado: true,
            puntaje: 2,
            verificado: true,
          }),
          documento('MBG-09', { pendiente: true, verificado: true }),
        ]),
      );

      // Solo los documentos de gestión (MBG), no los del animal (M4).
      expect(componente.indicadores().length).toBe(3);
      expect(componente.avance()).toEqual({ verificados: 2, total: 3 });
      expect(texto()).toContain('2 de 3 verificados');

      // El documento activo arranca por el primero y la lista lo marca.
      expect(componente.documentoActivo()).toBe('MBG-01');
      expect(texto()).toContain('Revisando');
      expect(texto()).toContain('2 pts');
      expect(texto()).toContain('Pendiente');
      expect(texto()).toContain('Sin ver');
    });

    it('elegir «Sí» habilita el chequeo y el puntaje (RF27–RF28)', async () => {
      await configurar(crearInspeccion());
      componente.abrirDocumento('MBG-04');
      componente.marcarPresentado(true);
      fixture.detectChanges();

      expect(texto()).toContain('Condiciones del documento');
      // El POE exige firma de MV/MVZ; el agua no (RF28).
      expect(texto()).toContain('Firma de MV/MVZ con matrícula vigente');

      componente.alternarLegible();
      componente.alternarFirmadoResponsable();
      componente.alternarFirmadoProfesional();
      componente.calificar(1);
      fixture.detectChanges();

      const documentoActivo = componente.documentoActivoEvaluado();
      expect(documentoActivo?.legible).toBe(true);
      expect(documentoActivo?.firmadoResponsable).toBe(true);
      expect(documentoActivo?.firmadoProfesional).toBe(true);
      expect(documentoActivo?.puntaje).toBe(1);
      expect(texto()).toContain('Cumple parcial');

      // Volver a pulsar el mismo puntaje lo borra.
      componente.calificar(1);
      expect(componente.documentoActivoEvaluado()?.puntaje).toBeNull();

      // Un documento que no exige firma profesional no la muestra.
      componente.abrirDocumento('MBG-01');
      componente.marcarPresentado(true);
      fixture.detectChanges();
      expect(texto()).not.toContain('Firma de MV/MVZ con matrícula vigente');
    });

    it('sin documento, el puntaje es 0 automáticamente (RF29)', async () => {
      await configurar(crearInspeccion());
      componente.marcarPresentado(false);
      fixture.detectChanges();

      expect(componente.documentoActivoEvaluado()?.puntaje).toBe(0);
      expect(texto()).toContain(
        'Si no se presenta, el indicador se califica con 0 puntos.',
      );

      // Al volver a «Sí» el puntaje se califica otra vez.
      componente.marcarPresentado(true);
      expect(componente.documentoActivoEvaluado()?.puntaje).toBeNull();
    });

    it('la mortalidad se califica por rangos (RF30)', async () => {
      await configurar(crearInspeccion());
      componente.abrirDocumento('MBG-09');
      componente.marcarPresentado(true);
      fixture.detectChanges();

      // Engorde: hasta 6 % son 2 puntos, hasta 9 % es 1 y más es 0.
      componente.cambiarMortalidad(evento('7,5'));
      expect(componente.documentoActivoEvaluado()?.puntaje).toBe(1);
      componente.cambiarMortalidad(evento('5'));
      expect(componente.documentoActivoEvaluado()?.puntaje).toBe(2);
      componente.cambiarMortalidad(evento('10'));
      expect(componente.documentoActivoEvaluado()?.puntaje).toBe(0);
      fixture.detectChanges();
      expect(texto()).toContain('hasta 6 % → 2 pts');

      // Una tasa imposible se avisa y no deja guardar.
      componente.cambiarMortalidad(evento('120'));
      fixture.detectChanges();
      expect(componente.mensajeTasa()).toContain('entre 0 % y 100 %');
      const emitidos = escucharGuardados();
      componente.guardarBorrador();
      expect(emitidos.length).toBe(0);
      expect(componente.error()).toContain('entre 0 % y 100 %');

      // Texto que no es número: también se avisa.
      componente.cambiarMortalidad(evento('abc'));
      expect(componente.mensajeTasa()).toContain('debe ser un número');
    });

    it('avisa si el catálogo no trae los rangos del indicador (RF38)', async () => {
      const respuesta = crearInspeccion();
      // Un catálogo sin rangos para MBG-09: la tasa no se puede calificar.
      respuesta.catalogo = {
        ...CATALOGO,
        indicadores: CATALOGO.indicadores.map((fila) =>
          fila.codigo === 'MBG-09' ? { ...fila, escalaRangos: null } : fila,
        ),
      };
      await configurar(respuesta);

      componente.abrirDocumento('MBG-09');
      componente.marcarPresentado(true);
      componente.cambiarMortalidad(evento('7,5'));
      fixture.detectChanges();

      expect(componente.documentoActivoEvaluado()?.puntaje).toBeNull();
      expect(texto()).toContain('salen del catálogo');

      const emitidos = escucharGuardados();
      componente.guardarBorrador();
      expect(emitidos.length).toBe(0);
      expect(componente.error()).toContain('no tiene los rangos');
    });

    it('guarda el borrador y pasa al siguiente documento (RF26, RF31)', async () => {
      await configurar(crearInspeccion());
      const emitidos = escucharGuardados();

      componente.marcarPresentado(true);
      componente.calificar(2);
      componente.alternarPendiente();
      componente.guardarBorrador();

      expect(emitidos.length).toBe(1);
      expect(emitidos[0].length).toBe(1);
      expect(emitidos[0][0].indicadorCodigo).toBe('MBG-01');
      expect(emitidos[0][0].puntaje).toBe(2);
      expect(emitidos[0][0].pendiente).toBe(true);

      // «Siguiente documento» guarda y abre el que sigue.
      componente.siguiente();
      expect(emitidos.length).toBe(2);
      expect(componente.documentoActivo()).toBe('MBG-04');
    });

    it('no guarda un documento con un dato imposible (RF29)', async () => {
      await configurar(
        crearInspeccion('CORRAL', [
          documento('MBG-01', { presentado: false, puntaje: 2 }),
        ]),
      );
      const emitidos = escucharGuardados();
      componente.guardarBorrador();

      expect(emitidos.length).toBe(0);
      expect(componente.error()).toContain('el puntaje es 0');
      expect(componente.documentoActivo()).toBe('MBG-01');
    });
  });

  describe('en traspatio', () => {
    it('la fase documental no aplica (RF33)', async () => {
      await configurar(crearInspeccion('TRASPATIO'));
      fixture.detectChanges();

      expect(componente.reglas().aplica).toBe(false);
      expect(texto()).toContain('En traspatio no hay indicadores de gestión');
      expect(texto()).not.toContain('Documentos (MBG)');
    });
  });
});
