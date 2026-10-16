import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SesionRespuesta, Usuario } from '../../core/auth/auth.modelos';
import { AuthService } from '../../core/auth/auth.service';
import { calculoVacio } from '../../core/inspeccion/calculo.modelos';
import type {
  Catalogo,
  InspeccionRespuesta,
} from '../../core/inspeccion/inspeccion.modelos';
import type { ListaVisitas } from '../../core/visitas/visitas.modelos';
import { reglasFase3 } from '../../core/inspeccion/fase3.modelos';
import { Fase2GalponComponent } from './fase2-galpon.component';
import { Fase3DocumentalComponent } from './fase3-documental.component';
import { InspeccionComponent } from './inspeccion.component';

const USUARIO: Usuario = {
  id: '33333333-3333-3333-3333-333333333333',
  nombreCompleto: 'Ana Ruiz',
  correo: 'ana.ruiz@entidad.gov.co',
  rol: 'INSPECTOR',
  etiquetaRol: 'Inspector',
  estado: 'ACTIVO',
  debeCambiarPassword: false,
  tienePin: true,
  ultimoAcceso: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  permisos: ['visitas:consultar', 'inspeccion:registrar'],
};

const SESION: SesionRespuesta = {
  accessToken: 'acceso',
  refreshToken: 'refresco',
  expiraEnSegundos: 900,
  refreshExpiraEnSegundos: 604800,
  sesionInactividadMinutos: 15,
  usuario: USUARIO,
};

const VISITA_ID = '44444444-4444-4444-4444-444444444444';

const CATALOGO: Catalogo = {
  version: '2.0',
  anio: 2024,
  vigenteDesde: '2024-01-01',
  provisional: true,
  nota: null,
  pesosCorral: [
    { grupo: 'MBA', etiqueta: 'Animal (MBA)', peso: 35 },
    { grupo: 'MBR', etiqueta: 'Recursos (MBR)', peso: 35 },
    { grupo: 'MBG', etiqueta: 'Gestión (MBG)', peso: 30 },
  ],
  pesosTraspatio: [
    { grupo: 'MBA', etiqueta: 'Animal (MBA)', peso: 60 },
    { grupo: 'MBR', etiqueta: 'Recursos (MBR)', peso: 40 },
    { grupo: 'MBG', etiqueta: 'Gestión (MBG)', peso: 0 },
  ],
  gruposProductivos: [
    { codigo: 'POLLO_ENGORDE', etiqueta: 'Pollo de engorde' },
    { codigo: 'PONEDORA_PISO', etiqueta: 'Ponedora en piso o pastoreo' },
    { codigo: 'PONEDORA_JAULA', etiqueta: 'Ponedora en jaula' },
  ],
  sistemasProduccion: [
    { codigo: 'ABIERTO_MECANIZADO', etiqueta: 'Abierto mecanizado' },
  ],
  indicadores: [
    {
      codigo: 'MBA-01',
      nombre: 'Indicador del animal 1 (nombre por confirmar)',
      grupo: 'MBA',
      etiquetaGrupo: 'Animal (MBA)',
      metodo: null,
      orden: 1,
      escalaMin: 0,
      escalaMax: 2,
      escalaDescripciones: null,
      tipoMuestreo: 'PUNTOS_9',
      pregunta: null,
      tipoEvaluacion: 'PUNTAJE',
      escalaRangos: null,
      exigeFirmaProfesional: false,
      gruposProductivos: ['POLLO_ENGORDE', 'PONEDORA_PISO', 'PONEDORA_JAULA'],
    },
    {
      codigo: 'MBR-01',
      nombre: 'Partículas en el aire',
      grupo: 'MBR',
      etiquetaGrupo: 'Recursos (MBR)',
      metodo: null,
      orden: 1,
      escalaMin: 0,
      escalaMax: 2,
      escalaDescripciones: null,
      tipoMuestreo: 'PUNTOS_9',
      pregunta: null,
      tipoEvaluacion: 'PUNTAJE',
      escalaRangos: null,
      exigeFirmaProfesional: false,
      gruposProductivos: ['POLLO_ENGORDE', 'PONEDORA_PISO', 'PONEDORA_JAULA'],
    },
    {
      codigo: 'MBG-01',
      nombre: 'Calidad del agua',
      grupo: 'MBG',
      etiquetaGrupo: 'Gestión (MBG)',
      metodo: null,
      orden: 1,
      escalaMin: 0,
      escalaMax: 2,
      escalaDescripciones: null,
      tipoMuestreo: 'PUNTOS_9',
      pregunta: null,
      tipoEvaluacion: 'PUNTAJE',
      escalaRangos: null,
      exigeFirmaProfesional: false,
      gruposProductivos: ['POLLO_ENGORDE', 'PONEDORA_PISO', 'PONEDORA_JAULA'],
    },
  ],
  aplicables: {
    POLLO_ENGORDE: ['MBA-01', 'MBR-01', 'MBG-01'],
    PONEDORA_PISO: ['MBA-01', 'MBR-01', 'MBG-01'],
    PONEDORA_JAULA: ['MBA-01', 'MBR-01', 'MBG-01'],
  },
};

const INSPECCION: InspeccionRespuesta = {
  visita: {
    id: VISITA_ID,
    estado: 'PROGRAMADA',
    etiquetaEstado: 'Programada',
    programadaPara: '2026-10-20T14:00:00.000Z',
    inspector: USUARIO.nombreCompleto,
  },
  predio: {
    id: '55555555-5555-5555-5555-555555555555',
    nombre: 'Granja El Rosal',
    municipio: 'Sopó',
    vereda: 'Vereda 1',
    responsable: null,
    numeroAves: null,
    sistemaProduccion: null,
    etiquetaSistemaProduccion: null,
    tipoPredio: 'CORRAL',
    etiquetaTipoPredio: 'Granja (corral)',
  },
  ficha: {
    grupoProductivo: null,
    etiquetaGrupoProductivo: null,
    fechaHora: null,
    observaciones: null,
    tipoPredio: 'CORRAL',
    etiquetaTipoPredio: 'Granja (corral)',
    pesos: CATALOGO.pesosCorral,
    galponesSugeridos: null,
    guardada: false,
  },
  galpones: [
    {
      id: '66666666-6666-6666-6666-666666666666',
      numero: 1,
      edadSemanas: 40,
      aves: 5000,
      seleccionado: true,
      sugerido: true,
    },
  ],
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
    avance: [
      {
        galponNumero: 1,
        grupos: [
          { grupo: 'MBA', etiqueta: 'Animal (MBA)', completos: 0, total: 1 },
          { grupo: 'MBR', etiqueta: 'Recursos (MBR)', completos: 0, total: 1 },
        ],
      },
    ],
  },
  fase3: {
    reglas: reglasFase3('CORRAL', null),
    documentos: [],
    avance: { verificados: 0, total: 0 },
  },
  calculo: calculoVacio(),
};

const LISTA: ListaVisitas = {
  datos: [
    {
      id: VISITA_ID,
      predio: {
        id: INSPECCION.predio.id,
        nombre: 'Granja El Rosal',
        municipio: 'Sopó',
        vereda: 'Vereda 1',
        tipoPredio: 'CORRAL',
        etiquetaTipoPredio: 'Granja (corral)',
      },
      inspector: { id: USUARIO.id, nombreCompleto: USUARIO.nombreCompleto },
      programadaPara: '2026-10-20T14:00:00.000Z',
      estado: 'PROGRAMADA',
      etiquetaEstado: 'Programada',
      observaciones: null,
      calificacion: null,
      clasificacion: null,
      etiquetaClasificacion: null,
      editable: true,
      accionesPosibles: ['EN_CURSO'],
      createdAt: '2026-10-15T12:00:00.000Z',
      updatedAt: '2026-10-15T12:00:00.000Z',
    },
  ],
  total: 1,
  pagina: 1,
  porPagina: 50,
  conteos: {
    todas: 1,
    programadas: 1,
    enCurso: 0,
    pendientesDocumentos: 0,
    cerradas: 0,
  },
};

const esPeticion =
  (ruta: string, metodo: string) =>
  (peticion: { url: string; method: string }) =>
    peticion.url.startsWith(`${environment.apiUrl}${ruta}`) &&
    peticion.method === metodo;

/** Deja avanzar las promesas pendientes (peticiones ya emitidas). */
const tick = () => new Promise((resolver) => setTimeout(resolver, 0));

/** Apertura y ficha general, Fase I (M3 · RF13–RF17). */
describe('InspeccionComponent', () => {
  let fixture: ComponentFixture<InspeccionComponent>;
  let componente: InspeccionComponent;
  let http: HttpTestingController;

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function configurar(visitaId: string | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [InspeccionComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(visitaId ? { visitaId } : {})),
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    const sesion = auth.iniciarSesion({
      correo: USUARIO.correo,
      password: 'Definitiva2026*',
    });
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(SESION);
    await sesion;

    fixture = TestBed.createComponent(InspeccionComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    await tick();
  }

  afterEach(() => {
    localStorage.clear();
    http.verify();
  });

  beforeEach(() => localStorage.clear());

  describe('sin visita elegida', () => {
    beforeEach(async () => {
      await configurar(null);
      http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);
      await tick();
      fixture.detectChanges();
    });

    it('lista las visitas abiertas para elegir cuál inspeccionar (RF13)', () => {
      expect(texto()).toContain('Granja El Rosal');
      expect(texto()).toContain('Programada');
    });
  });

  describe('con una visita abierta', () => {
    beforeEach(async () => {
      await configurar(VISITA_ID);
      http
        .expectOne(esPeticion(`/inspeccion/${VISITA_ID}`, 'GET'))
        .flush(INSPECCION);
      await tick();
      fixture.detectChanges();
    });

    it('muestra la ficha, la clasificación y los pesos (RF13, RF14)', () => {
      expect(texto()).toContain('Ficha general del predio');
      expect(texto()).toContain('Granja El Rosal');
      expect(texto()).toContain('Granja · Corral');
      // Pesos de corral: 35 / 35 / 30.
      expect(texto()).toContain('35 %');
      expect(texto()).toContain('30 %');
      // Catálogo provisional marcado.
      expect(texto()).toContain('Catálogo provisional');
    });

    it('rechaza letras, decimales y negativos en el número de aves', () => {
      const aves = componente.ficha.controls.numeroAves;
      aves.setValue('abc');
      expect(aves.invalid).toBe(true);
      expect(aves.hasError('noNumero')).toBe(true);

      aves.setValue('12.5');
      expect(aves.hasError('noEntero')).toBe(true);

      aves.setValue(-10);
      expect(aves.hasError('min')).toBe(true);

      aves.setValue(150);
      expect(aves.valid).toBe(true);
    });

    it('no guarda si hay un galpón con datos inválidos', async () => {
      componente.agregarGalpon();
      componente.galpones.controls[0].controls.aves.setValue('muchas');
      fixture.detectChanges();

      await componente.guardar(false);

      expect(componente.error()).toBe('Revise los campos marcados en rojo.');
    });

    it('clasifica como traspatio con 199 aves o menos (RF14)', () => {
      componente.ficha.controls.numeroAves.setValue(150);
      fixture.detectChanges();

      expect(componente.clasificacion()).toBe('TRASPATIO');
      expect(componente.pesos().map((peso) => [peso.grupo, peso.peso])).toEqual(
        [
          ['MBA', 60],
          ['MBR', 40],
          ['MBG', 0],
        ],
      );
      expect(componente.galponesSugeridos()).toBe(1);
    });

    it('sugiere dos galpones y prioriza los de mayor edad (RF16)', () => {
      componente.ficha.controls.numeroAves.setValue(62000);
      componente.agregarGalpon();
      componente.agregarGalpon();
      componente.galpones.controls[0].controls.edadSemanas.setValue(18);
      componente.galpones.controls[1].controls.edadSemanas.setValue(62);
      fixture.detectChanges();

      expect(componente.galponesSugeridos()).toBe(2);
      expect(componente.sugeridos()).toEqual([2, 1]);
    });

    it('carga los indicadores del grupo productivo elegido (RF17)', () => {
      expect(componente.indicadores().length).toBe(0);

      componente.elegirGrupo('PONEDORA_JAULA');
      fixture.detectChanges();

      expect(componente.indicadores().length).toBe(3);
      expect(componente.etiquetaGrupo()).toBe('Ponedora en jaula');
      expect(texto()).toContain('Partículas en el aire');
    });

    it('guarda el borrador por la cola de sincronización (RF12)', async () => {
      componente.ficha.controls.numeroAves.setValue(62000);
      componente.elegirGrupo('POLLO_ENGORDE');
      fixture.detectChanges();

      const guardado = componente.guardar(false);
      await tick();

      const sincronizar = http.expectOne(
        esPeticion('/visitas/sincronizar', 'POST'),
      );
      const operacion = sincronizar.request.body.operaciones[0];
      expect(operacion.tipo).toBe('GUARDAR_INSPECCION');
      expect(operacion.visitaId).toBe(VISITA_ID);
      expect(operacion.inspeccion.numeroAves).toBe(62000);
      expect(operacion.inspeccion.grupoProductivo).toBe('POLLO_ENGORDE');
      sincronizar.flush({
        resultados: [{ id: operacion.id, estado: 'APLICADA' }],
        visitas: [],
      });

      // Tras sincronizar, el servicio refresca la lista de visitas (RF12).
      await tick();
      http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);

      // Y la pantalla vuelve a leer la ficha del servidor.
      await tick();
      http.expectOne(esPeticion(`/inspeccion/${VISITA_ID}`, 'GET')).flush({
        ...INSPECCION,
        ficha: { ...INSPECCION.ficha, guardada: true },
      });
      await guardado;
      fixture.detectChanges();

      expect(texto()).toContain('Borrador guardado');
    });
  });

  describe('Fase II · inspección en galpón (RF18–RF26)', () => {
    /** La inspección con la Fase I ya guardada (grupo productivo elegido). */
    const CON_FICHA: InspeccionRespuesta = {
      ...INSPECCION,
      ficha: {
        ...INSPECCION.ficha,
        grupoProductivo: 'POLLO_ENGORDE',
        etiquetaGrupoProductivo: 'Pollo de engorde',
        guardada: true,
      },
    };

    const hijo = () =>
      fixture.debugElement.query(By.directive(Fase2GalponComponent))
        .componentInstance as Fase2GalponComponent;

    beforeEach(async () => {
      await configurar(VISITA_ID);
      http
        .expectOne(esPeticion(`/inspeccion/${VISITA_ID}`, 'GET'))
        .flush(CON_FICHA);
      await tick();
      fixture.detectChanges();

      componente.faseActiva.set(2);
      fixture.detectChanges();
      // El efecto de la Fase II siembra el estado en el primer chequeo; este
      // segundo vuelve a pintar con lo sembrado.
      fixture.detectChanges();
    });

    it('muestra los indicadores con su avance y el cálculo en vivo (RF17, RF24)', () => {
      expect(texto()).toContain('Indicadores MBR');
      expect(texto()).toContain('Partículas en el aire');
      expect(texto()).toContain('Cálculo en vivo');
      expect(texto()).toContain('Avance galpón 1');
    });

    it('califica puntos y calcula promedio y valor del indicador (RF19, RF34)', () => {
      hijo().abrirIndicador('MBA-01');
      for (const [numero, valor] of [
        [1, 2],
        [2, 2],
        [3, 1],
        [4, 1],
      ] as const) {
        hijo().seleccionarPunto(numero);
        hijo().calificar(valor);
      }
      fixture.detectChanges();

      // (2 + 2 + 1 + 1) / 4 = 1.50 → (1.50 × 100) / 2 = 75 %.
      expect(hijo().calculo()?.promedio).toBe(1.5);
      expect(hijo().calculo()?.valor).toBe(75);
      expect(hijo().calculo()?.faltan).toBe(5);
      expect(texto()).toContain('75 %');
      expect(texto()).toContain('Faltan 5 de 9 puntos');
    });

    it('guarda las evaluaciones por la misma cola (RF12, RF26)', async () => {
      hijo().abrirIndicador('MBA-01');
      hijo().seleccionarPunto(1);
      hijo().calificar(2);
      hijo().guardarBorrador();
      await tick();

      const sincronizar = http.expectOne(
        esPeticion('/visitas/sincronizar', 'POST'),
      );
      const operacion = sincronizar.request.body.operaciones[0];
      expect(operacion.tipo).toBe('GUARDAR_INSPECCION');
      expect(operacion.inspeccion.evaluaciones.length).toBe(1);
      expect(operacion.inspeccion.evaluaciones[0].indicadorCodigo).toBe(
        'MBA-01',
      );
      expect(operacion.inspeccion.evaluaciones[0].puntos[0].puntaje).toBe(2);
      sincronizar.flush({
        resultados: [{ id: operacion.id, estado: 'APLICADA' }],
        visitas: [],
      });

      // Tras sincronizar, el servicio refresca la lista de visitas (RF12).
      await tick();
      http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);

      // Y la pantalla vuelve a leer la inspección del servidor.
      await tick();
      http
        .expectOne(esPeticion(`/inspeccion/${VISITA_ID}`, 'GET'))
        .flush(CON_FICHA);
      await tick();
      fixture.detectChanges();

      expect(texto()).toContain('Borrador guardado');
    });
  });

  describe('Fase III · inspección documental (RF27–RF33)', () => {
    /** La inspección con la Fase I ya guardada (grupo productivo elegido). */
    const CON_FICHA: InspeccionRespuesta = {
      ...INSPECCION,
      ficha: {
        ...INSPECCION.ficha,
        grupoProductivo: 'POLLO_ENGORDE',
        etiquetaGrupoProductivo: 'Pollo de engorde',
        guardada: true,
      },
    };

    const hijo = () =>
      fixture.debugElement.query(By.directive(Fase3DocumentalComponent))
        .componentInstance as Fase3DocumentalComponent;

    const fase3 = () =>
      componente.fases.find((fase) => fase.numero === 3) ?? componente.fases[0];

    beforeEach(async () => {
      await configurar(VISITA_ID);
      http
        .expectOne(esPeticion(`/inspeccion/${VISITA_ID}`, 'GET'))
        .flush(CON_FICHA);
      await tick();
      fixture.detectChanges();

      componente.faseActiva.set(3);
      fixture.detectChanges();
      // El efecto de la Fase III siembra el estado en el primer chequeo; este
      // segundo vuelve a pintar con lo sembrado.
      fixture.detectChanges();
    });

    it('muestra los documentos con su avance y la regla del 0 (RF24, RF27–RF29)', () => {
      expect(texto()).toContain('Documentos (MBG)');
      expect(texto()).toContain('0 de 1 verificados');
      expect(texto()).toContain('¿Se presentó el documento?');
      expect(texto()).toContain(
        'Si no se presenta, el indicador se califica con 0 puntos.',
      );
      expect(hijo().documentoActivo()).toBe('MBG-01');
    });

    it('guarda los documentos por la misma cola (RF12, RF26)', async () => {
      hijo().marcarPresentado(true);
      hijo().calificar(2);
      hijo().guardarBorrador();
      await tick();

      const sincronizar = http.expectOne(
        esPeticion('/visitas/sincronizar', 'POST'),
      );
      const operacion = sincronizar.request.body.operaciones[0];
      expect(operacion.tipo).toBe('GUARDAR_INSPECCION');
      expect(operacion.inspeccion.documentos.length).toBe(1);
      expect(operacion.inspeccion.documentos[0].indicadorCodigo).toBe('MBG-01');
      expect(operacion.inspeccion.documentos[0].puntaje).toBe(2);
      sincronizar.flush({
        resultados: [{ id: operacion.id, estado: 'APLICADA' }],
        visitas: [],
      });

      // Tras sincronizar, el servicio refresca la lista de visitas (RF12).
      await tick();
      http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);

      // Y la pantalla vuelve a leer la inspección del servidor.
      await tick();
      http
        .expectOne(esPeticion(`/inspeccion/${VISITA_ID}`, 'GET'))
        .flush(CON_FICHA);
      await tick();
      fixture.detectChanges();

      expect(texto()).toContain('Borrador guardado');
    });

    it('en traspatio la pestaña queda sin aplicar (RF33)', async () => {
      // La visita se reclasifica como traspatio desde la Fase I.
      const traspatio: InspeccionRespuesta = {
        ...CON_FICHA,
        predio: { ...CON_FICHA.predio, tipoPredio: 'TRASPATIO' },
        ficha: {
          ...CON_FICHA.ficha,
          tipoPredio: 'TRASPATIO',
          etiquetaTipoPredio: 'Traspatio',
        },
        fase3: {
          ...CON_FICHA.fase3,
          reglas: reglasFase3('TRASPATIO', 'POLLO_ENGORDE'),
        },
      };
      componente.respuesta.set(traspatio);
      fixture.detectChanges();

      expect(componente.faseNoAplica(fase3())).toBe(true);
      expect(componente.claseFase(fase3())).toContain(
        'text-contenido-deshabilitado',
      );

      // Al pulsarla no cambia de fase: avisa que no aplica (RF33).
      componente.faseActiva.set(1);
      componente.abrirFase(fase3());
      expect(componente.aviso()).toContain('traspatio');
      expect(componente.faseActiva()).toBe(1);
    });
  });
});
