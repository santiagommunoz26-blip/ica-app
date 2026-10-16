import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
import type {
  Catalogo,
  InspeccionRespuesta,
} from '../../core/inspeccion/inspeccion.modelos';
import type { ListaVisitas } from '../../core/visitas/visitas.modelos';
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
  galpones: [],
  catalogo: CATALOGO,
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
      expect(texto()).toContain('Granja (corral)');
      // Pesos de corral: 35 / 35 / 30.
      expect(texto()).toContain('35 %');
      expect(texto()).toContain('30 %');
      // Catálogo provisional marcado.
      expect(texto()).toContain('Catálogo provisional');
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
});
