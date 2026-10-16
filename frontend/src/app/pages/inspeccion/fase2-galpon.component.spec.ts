import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { environment } from '../../../environments/environment';
import type { EvaluacionRespuesta } from '../../core/inspeccion/fase2.modelos';
import { reglasFase2 } from '../../core/inspeccion/fase2.modelos';
import type {
  Catalogo,
  GrupoProductivo,
  IndicadorCatalogo,
  InspeccionRespuesta,
} from '../../core/inspeccion/inspeccion.modelos';
import { SincronizacionService } from '../../core/visitas/sincronizacion.service';
import { Fase2GalponComponent } from './fase2-galpon.component';

const VISITA_ID = 'visita-1';

/** Indicador de prueba. */
function indicador(
  codigo: string,
  nombre: string,
  grupo: 'MBA' | 'MBR' | 'MBG',
  extra: Partial<IndicadorCatalogo> = {},
): IndicadorCatalogo {
  return {
    codigo,
    nombre,
    grupo,
    etiquetaGrupo: grupo,
    metodo: null,
    orden: Number(codigo.split('-')[1]),
    escalaMin: 0,
    escalaMax: 2,
    escalaDescripciones: null,
    tipoMuestreo: 'PUNTOS_9',
    pregunta: null,
    gruposProductivos: ['POLLO_ENGORDE', 'PONEDORA_PISO', 'PONEDORA_JAULA'],
    ...extra,
  };
}

/** Catálogo de prueba con lo que el wireframe ya muestra (M4). */
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
    indicador('MBA-01', 'Indicador del animal 1', 'MBA'),
    indicador('MBR-01', 'Partículas en el aire', 'MBR', {
      tipoMuestreo: 'HOJAS_CENTINELA',
    }),
    indicador('MBR-02', 'Calidad de la cama', 'MBR', {
      pregunta: '¿La calidad de la cama es adecuada?',
      escalaDescripciones: [
        'Muy compacta por humedad',
        'Ligeramente compactada',
        'Suelta, se desmorona',
      ],
    }),
    indicador('MBG-01', 'Calidad del agua', 'MBG'),
  ],
  aplicables: {
    POLLO_ENGORDE: ['MBA-01', 'MBR-01', 'MBR-02', 'MBG-01'],
    PONEDORA_PISO: ['MBA-01', 'MBR-01', 'MBR-02', 'MBG-01'],
    PONEDORA_JAULA: ['MBA-01', 'MBR-01', 'MBR-02', 'MBG-01'],
  },
};

/** Evaluación completa de un indicador, como la devuelve el servidor. */
function evaluacionCompleta(
  indicadorCodigo: string,
  puntaje = 2,
): EvaluacionRespuesta {
  return {
    galponNumero: 1,
    indicadorCodigo,
    noAplica: false,
    motivoNoAplica: null,
    observaciones: null,
    puntos: Array.from({ length: 9 }, (_, indice) => ({
      numero: indice + 1,
      puntaje,
      aves: 20,
      jaulas: null,
    })),
    guardadoEn: '2026-10-16T10:00:00.000Z',
    promedio: puntaje,
    valor: (puntaje * 100) / 2,
    puntosRegistrados: 9,
    completo: true,
  };
}

/** Respuesta de la inspección, con la Fase I ya guardada. */
function crearInspeccion(
  grupo: GrupoProductivo,
  evaluaciones: EvaluacionRespuesta[] = [],
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
      numeroAves: 60000,
      sistemaProduccion: null,
      etiquetaSistemaProduccion: null,
      tipoPredio: 'CORRAL',
      etiquetaTipoPredio: 'Granja (corral)',
    },
    ficha: {
      grupoProductivo: grupo,
      etiquetaGrupoProductivo: 'Pollo de engorde',
      fechaHora: null,
      observaciones: null,
      tipoPredio: 'CORRAL',
      etiquetaTipoPredio: 'Granja (corral)',
      pesos: [],
      galponesSugeridos: 2,
      guardada: true,
    },
    galpones: [
      {
        id: 'galpon-1',
        numero: 1,
        edadSemanas: 40,
        aves: 5000,
        seleccionado: true,
        sugerido: true,
      },
    ],
    catalogo: CATALOGO,
    fase2: {
      reglas: reglasFase2('CORRAL', grupo),
      evaluaciones,
      evidencias: [],
      avance: [],
    },
  };
}

/** Deja avanzar las promesas pendientes (peticiones ya emitidas). */
const tick = () => new Promise((resolver) => setTimeout(resolver, 0));

/** Evento de un campo, como el que llega del formulario. */
const evento = (valor: string) =>
  ({ target: { value: valor } }) as unknown as Event;

/** Inspección en galpón, Fase II (M4 · RF18–RF26). */
describe('Fase2GalponComponent', () => {
  let fixture: ComponentFixture<Fase2GalponComponent>;
  let componente: Fase2GalponComponent;
  let http: HttpTestingController;

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function configurar(respuesta: InspeccionRespuesta): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Fase2GalponComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SincronizacionService,
          useValue: { enLinea: signal(true) },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Fase2GalponComponent);
    fixture.componentRef.setInput('respuesta', respuesta);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    // El efecto siembra el estado en el primer chequeo; este segundo vuelve a
    // pintar con lo sembrado.
    fixture.detectChanges();
  }

  /** Espera a que se emita la petición que cumpla el criterio. */
  async function esperarPeticion(
    criterio: (peticion: { url: string }) => boolean,
  ): Promise<TestRequest> {
    for (let intento = 0; intento < 100; intento += 1) {
      const [peticion] = http.match(criterio);
      if (peticion) return peticion;
      await tick();
    }
    throw new Error('No se emitió la petición esperada.');
  }

  afterEach(() => http.verify());

  /** Puntaje registrado en un punto, o nulo. */
  const puntaje = (numero: number) =>
    componente.puntos().find((fila) => fila.numero === numero)?.punto.puntaje ??
    null;

  describe('en piso, con pollo de engorde', () => {
    it('carga lo guardado y muestra el avance del galpón (RF24)', async () => {
      await configurar(
        crearInspeccion('POLLO_ENGORDE', [evaluacionCompleta('MBA-01')]),
      );

      // La fase arranca por MBR y por el primer indicador sin completar.
      expect(componente.indicadorActivo()).toBe('MBR-01');
      expect(componente.puntos().length).toBe(3);
      expect(componente.estaCompleto('MBA-01')).toBe(true);
      expect(componente.textoAvance()).toBe('MBR 0/2 · MBA 1/1');
      expect(texto()).toContain('Indicadores MBR');
      expect(texto()).toContain('0 de 2 completos');
    });

    it('califica puntos y calcula promedio y valor del indicador (RF19, RF34)', async () => {
      await configurar(crearInspeccion('POLLO_ENGORDE'));

      componente.abrirIndicador('MBA-01');
      for (const [numero, valor] of [
        [1, 2],
        [2, 2],
        [3, 1],
        [4, 1],
      ] as const) {
        componente.seleccionarPunto(numero);
        componente.calificar(valor);
      }
      fixture.detectChanges();

      // (2 + 2 + 1 + 1) / 4 = 1.50 → (1.50 × 100) / 2 = 75 %.
      expect(componente.calculo()?.promedio).toBe(1.5);
      expect(componente.calculo()?.valor).toBe(75);
      expect(componente.calculo()?.faltan).toBe(5);
      expect(texto()).toContain('75 %');
      expect(texto()).toContain('Faltan 5 de 9 puntos');

      // Volver a pulsar el mismo puntaje lo borra.
      componente.seleccionarPunto(1);
      componente.calificar(2);
      expect(puntaje(1)).toBeNull();
    });

    it('muestra la pregunta y las descripciones de la escala (RF19)', async () => {
      await configurar(crearInspeccion('POLLO_ENGORDE'));

      componente.abrirIndicador('MBR-02');
      fixture.detectChanges();

      expect(texto()).toContain('¿La calidad de la cama es adecuada?');
      expect(texto()).toContain('Suelta, se desmorona');
      // La píldora del grupo y el método, como en el wireframe.
      expect(texto()).toContain('MBR · visual con muestreo');
      expect(componente.descripcionPuntaje(CATALOGO.indicadores[2], 2)).toBe(
        'Suelta, se desmorona',
      );
    });

    it('las hojas centinela piden el mínimo y dejan agregar más (RF22)', async () => {
      await configurar(crearInspeccion('POLLO_ENGORDE'));

      componente.abrirIndicador('MBR-01');

      // En corral el mínimo es 3 hojas.
      expect(componente.puntos().length).toBe(3);

      for (const numero of [1, 2, 3]) {
        componente.seleccionarPunto(numero);
        componente.cambiarAves(evento('20'));
        componente.calificar(2);
      }
      expect(componente.estaCompleto('MBR-01')).toBe(true);

      // Se puede agregar otra hoja; mientras esté vacía el indicador queda
      // incompleto, igual que con los 9 puntos fijos.
      componente.agregarHoja();
      expect(componente.puntos().length).toBe(4);
      expect(componente.estaCompleto('MBR-01')).toBe(false);

      componente.seleccionarPunto(4);
      componente.cambiarAves(evento('20'));
      componente.calificar(2);
      expect(componente.estaCompleto('MBR-01')).toBe(true);
    });

    it('valida la muestra antes de guardar (RF20)', async () => {
      await configurar(crearInspeccion('POLLO_ENGORDE'));

      const emitidas: unknown[] = [];
      componente.guardar.subscribe((evaluaciones) =>
        emitidas.push(evaluaciones),
      );

      componente.seleccionarPunto(1);
      componente.cambiarAves(evento('5'));
      componente.calificar(2);
      componente.guardarBorrador();

      expect(emitidas.length).toBe(0);
      expect(componente.error()).toContain('entre 15 y 30 aves');
    });

    it('entrega las evaluaciones diligenciadas (RF26)', async () => {
      await configurar(crearInspeccion('POLLO_ENGORDE'));

      const emitidas: unknown[] = [];
      componente.guardar.subscribe((evaluaciones) =>
        emitidas.push(evaluaciones),
      );

      componente.seleccionarPunto(1);
      componente.calificar(2);
      componente.guardarBorrador();

      expect(emitidas.length).toBe(1);
      const evaluaciones = emitidas[0] as {
        indicadorCodigo: string;
        puntos: { puntaje: number | null }[];
      }[];
      expect(evaluaciones.length).toBe(1);
      expect(evaluaciones[0].indicadorCodigo).toBe('MBR-01');
      expect(evaluaciones[0].puntos[0].puntaje).toBe(2);
    });

    it('«Guardar y siguiente» pasa al siguiente indicador (RF26)', async () => {
      await configurar(crearInspeccion('POLLO_ENGORDE'));

      const emitidas: unknown[] = [];
      componente.guardar.subscribe((evaluaciones) =>
        emitidas.push(evaluaciones),
      );

      componente.seleccionarPunto(1);
      componente.calificar(2);
      componente.guardarYSiguiente();

      expect(emitidas.length).toBe(1);
      expect(componente.indicadorActivo()).toBe('MBR-02');
    });

    it('«No aplica» exige el motivo y sale del cálculo (RF25)', async () => {
      await configurar(crearInspeccion('POLLO_ENGORDE'));

      const emitidas: unknown[] = [];
      componente.guardar.subscribe((evaluaciones) =>
        emitidas.push(evaluaciones),
      );

      componente.cambiarNoAplica(true);
      componente.guardarBorrador();

      expect(emitidas.length).toBe(0);
      expect(componente.error()).toContain('motivo');

      componente.cambiarMotivo(evento('Sin acceso al galpón'));
      componente.guardarBorrador();

      expect(emitidas.length).toBe(1);
      const evaluaciones = emitidas[0] as {
        noAplica: boolean;
        motivoNoAplica: string | null;
      }[];
      expect(evaluaciones[0].noAplica).toBe(true);
      expect(evaluaciones[0].motivoNoAplica).toBe('Sin acceso al galpón');
    });

    it('adjunta una foto con la URL firmada (RF23, ADR-003)', async () => {
      await configurar(crearInspeccion('POLLO_ENGORDE'));

      const refrescos: number[] = [];
      componente.refrescar.subscribe(() => refrescos.push(1));

      const archivo = new File(['foto'], 'cama.jpg', { type: 'image/jpeg' });
      const subida = componente.adjuntarFoto({
        target: { files: [archivo], value: '' },
      } as unknown as Event);

      // La huella del archivo se calcula antes de pedir la URL firmada.
      const crear = await esperarPeticion((peticion) =>
        peticion.url.endsWith('/evidencias'),
      );
      expect(crear.request.body.nombre).toBe('cama.jpg');
      expect(crear.request.body.galponNumero).toBe(1);
      expect(crear.request.body.indicadorCodigo).toBe('MBR-01');
      crear.flush({
        evidencia: {
          id: 'evidencia-1',
          galponNumero: 1,
          indicadorCodigo: 'MBA-01',
          nombre: 'cama.jpg',
          tipo: 'image/jpeg',
          tamano: 4,
          confirmada: false,
          creadaEn: '2026-10-16T10:00:00.000Z',
        },
        urlSubida: 'http://almacen.local/foto',
      });

      await tick();
      http.expectOne('http://almacen.local/foto').flush('');

      await tick();
      http
        .expectOne(
          `${environment.apiUrl}/inspeccion/evidencias/evidencia-1/confirmar`,
        )
        .flush({
          id: 'evidencia-1',
          galponNumero: 1,
          indicadorCodigo: 'MBA-01',
          nombre: 'cama.jpg',
          tipo: 'image/jpeg',
          tamano: 4,
          confirmada: true,
          creadaEn: '2026-10-16T10:00:00.000Z',
        });

      await subida;
      fixture.detectChanges();

      expect(componente.aviso()).toBe('Foto adjuntada.');
      expect(refrescos.length).toBe(1);
    });
  });

  describe('en jaula, con ponedora', () => {
    it('no deja calificar hasta contar jaulas y aves (RF21)', async () => {
      await configurar(crearInspeccion('PONEDORA_JAULA'));

      componente.abrirIndicador('MBA-01');
      expect(componente.puntos().length).toBe(9);

      componente.seleccionarPunto(1);
      componente.calificar(2);
      expect(puntaje(1)).toBeNull();

      componente.cambiarAves(evento('15'));
      componente.cambiarJaulas(evento('4'));
      componente.calificar(2);
      expect(puntaje(1)).toBe(2);
    });

    it('avisa cuando la muestra se sale de lo que pide la metodología (RF20)', async () => {
      await configurar(crearInspeccion('PONEDORA_JAULA'));

      componente.seleccionarPunto(1);
      componente.cambiarAves(evento('5'));
      componente.cambiarJaulas(evento('9'));

      const fila = componente.puntos().find((fila) => fila.numero === 1);
      expect(fila?.mensaje).toContain('entre 10 y 20 aves');
      expect(fila?.calificable).toBe(false);
    });
  });
});
