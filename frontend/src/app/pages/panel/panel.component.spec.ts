import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import type { SesionRespuesta, Usuario } from '../../core/auth/auth.modelos';
import { AuthService } from '../../core/auth/auth.service';
import type { ResumenPanel } from '../../core/visitas/visitas.modelos';
import { PanelComponent } from './panel.component';

const USUARIO: Usuario = {
  id: '11111111-1111-1111-1111-111111111111',
  nombreCompleto: 'Carlos Mejía',
  correo: 'carlos.mejia@entidad.gov.co',
  rol: 'ADMINISTRADOR',
  etiquetaRol: 'Administrador',
  estado: 'ACTIVO',
  debeCambiarPassword: false,
  tienePin: false,
  ultimoAcceso: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  permisos: ['visitas:consultar', 'visitas:crear', 'usuarios:gestionar'],
};

const SESION: SesionRespuesta = {
  accessToken: 'acceso',
  refreshToken: 'refresco',
  expiraEnSegundos: 900,
  refreshExpiraEnSegundos: 604800,
  sesionInactividadMinutos: 15,
  usuario: USUARIO,
};

const RESUMEN: ResumenPanel = {
  visitasDelMes: 24,
  variacionVisitas: 12,
  calificacionPromedio: 82.4,
  clasificacionPromedio: 'ALTO',
  etiquetaClasificacionPromedio: 'Alto',
  documentosPendientes: 3,
  totalVisitas: 24,
  predios: 24,
  evolucion: [
    { mes: '2026-05', etiqueta: 'May', calificacion: 78, visitas: 3 },
    { mes: '2026-06', etiqueta: 'Jun', calificacion: null, visitas: 0 },
    { mes: '2026-07', etiqueta: 'Jul', calificacion: 81.2, visitas: 4 },
  ],
  distribucion: [
    {
      clasificacion: 'EXCELENTE',
      etiqueta: 'Excelente',
      cantidad: 4,
      porcentaje: 17,
    },
    { clasificacion: 'ALTO', etiqueta: 'Alto', cantidad: 12, porcentaje: 50 },
    { clasificacion: 'MEDIO', etiqueta: 'Medio', cantidad: 6, porcentaje: 25 },
    { clasificacion: 'BAJO', etiqueta: 'Bajo', cantidad: 2, porcentaje: 8 },
  ],
  promedioPorGrupo: [],
  proximas: [
    {
      id: '44444444-4444-4444-4444-444444444444',
      predio: {
        id: '55555555-5555-5555-5555-555555555555',
        nombre: 'Granja El Rosal',
        municipio: 'Sopó',
        vereda: 'Vereda 1',
        tipoPredio: 'CORRAL',
        etiquetaTipoPredio: 'Granja (corral)',
      },
      inspector: { id: USUARIO.id, nombreCompleto: 'Ana Ruiz' },
      programadaPara: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
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
};

/** Panel principal con los indicadores de la evaluación (M2 · RF10). */
describe('PanelComponent', () => {
  let fixture: ComponentFixture<PanelComponent>;
  let componente: PanelComponent;
  let http: HttpTestingController;

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PanelComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
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

    fixture = TestBed.createComponent(PanelComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    http.verify();
  });

  /** Responde el resumen y refresca la vista. */
  async function conResumen(resumen: ResumenPanel): Promise<void> {
    const peticion = http.expectOne(
      (peticion) =>
        peticion.url === `${environment.apiUrl}/visitas/resumen` &&
        peticion.method === 'GET',
    );
    peticion.flush(resumen);
    await new Promise((resolver) => setTimeout(resolver, 0));
    fixture.detectChanges();
  }

  it('muestra los cuatro indicadores del wireframe (RF10)', async () => {
    await conResumen(RESUMEN);

    expect(componente.indicadores().map((i) => i.valor)).toEqual([
      '24', // visitas del mes
      '82.4', // calificación promedio
      '3', // pendientes de documentos
      '0', // sin sincronizar
    ]);
    expect(texto()).toContain('+12 % frente al mes pasado');
    expect(texto()).toContain('Nivel alto · sobre 100');
    expect(texto()).toContain('Visitas del mes');
    expect(texto()).toContain('Sin sincronizar');
  });

  it('muestra la evolución mes a mes y la distribución por clasificación (RF10)', async () => {
    await conResumen(RESUMEN);

    // La evolución conserva el hueco del mes sin resultado.
    expect(componente.etiquetasEvolucion()).toEqual(['May', 'Jun', 'Jul']);
    expect(componente.valoresEvolucion()).toEqual([78, null, 81.2]);

    // La distribución cuenta las visitas con resultado.
    expect(componente.totalClasificado()).toBe(24);
    expect(componente.textoTotalClasificado()).toBe('24');
    expect(texto()).toContain('Excelente');
    expect(texto()).toContain('50 %');
  });

  it('deja explicado lo que todavía no tiene datos (promedio por grupo)', async () => {
    await conResumen(RESUMEN);

    expect(componente.valoresGrupos()).toEqual([]);
    expect(texto()).toContain('Sin datos todavía');
  });

  it('lista las próximas visitas con una fecha amable (RF10)', async () => {
    await conResumen(RESUMEN);

    expect(componente.proximas().length).toBe(1);
    expect(texto()).toContain('Granja El Rosal');
    expect(texto()).toContain('Hoy ·');
  });

  it('sin resumen del servidor muestra ceros y no falla', async () => {
    http
      .expectOne(
        (peticion) => peticion.url === `${environment.apiUrl}/visitas/resumen`,
      )
      .error(new ProgressEvent('error'));

    await new Promise((resolver) => setTimeout(resolver, 0));
    fixture.detectChanges();

    expect(componente.indicadores().map((i) => i.valor)).toEqual([
      '0',
      '—',
      '0',
      '0',
    ]);
  });

  it('permite configurar el PIN desde el panel (RF03)', async () => {
    await conResumen(RESUMEN);

    // El botón del bloque «Acceso sin conexión (PIN)» tiene que verse: es la
    // única entrada para crear el PIN con el que se entra sin conexión.
    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((candidato) => candidato.textContent?.includes('Configurar'));
    expect(boton).withContext('botón Configurar del PIN').toBeTruthy();

    boton?.click();
    fixture.detectChanges();

    expect(componente.mostrarPin()).toBe(true);
    expect(texto()).toContain('Guardar PIN');
    expect(texto()).toContain('PIN (6 dígitos)');
  });
});
