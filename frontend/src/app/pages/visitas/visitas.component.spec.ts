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
import type { ListaVisitas } from '../../core/visitas/visitas.modelos';
import { VisitasComponent } from './visitas.component';

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
  permisos: ['visitas:consultar', 'visitas:crear'],
};

const SESION: SesionRespuesta = {
  accessToken: 'acceso',
  refreshToken: 'refresco',
  expiraEnSegundos: 900,
  refreshExpiraEnSegundos: 604800,
  sesionInactividadMinutos: 15,
  usuario: USUARIO,
};

const LISTA: ListaVisitas = {
  datos: [
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
  total: 7,
  pagina: 1,
  porPagina: 10,
  conteos: {
    todas: 7,
    programadas: 4,
    enCurso: 2,
    pendientesDocumentos: 1,
    cerradas: 3,
  },
};

const esPeticion =
  (ruta: string, metodo: string) =>
  (peticion: { url: string; method: string }) =>
    peticion.url.startsWith(`${environment.apiUrl}${ruta}`) &&
    peticion.method === metodo;

/** Deja avanzar las promesas pendientes (peticiones ya emitidas). */
const tick = () => new Promise((resolver) => setTimeout(resolver, 0));

/** Gestión de visitas en pantalla (M2 · RF08–RF12). */
describe('VisitasComponent', () => {
  let fixture: ComponentFixture<VisitasComponent>;
  let componente: VisitasComponent;
  let http: HttpTestingController;

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [VisitasComponent],
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

    fixture = TestBed.createComponent(VisitasComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();

    // La consulta sale en la siguiente vuelta del bucle de eventos.
    await tick();
    http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);
    await tick();
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    http.verify();
  });

  it('lista las visitas con predio, fecha, estado y calificación (RF11)', () => {
    expect(componente.lista()?.total).toBe(7);
    expect(texto()).toContain('Granja El Rosal');
    expect(texto()).toContain('Sopó · Vereda 1');
    expect(texto()).toContain('Granja (corral)');
    expect(texto()).toContain('Programada');
    // Sin resultado todavía (lo llena M6): se muestra un guion.
    expect(texto()).toContain('—');
  });

  it('muestra el conteo de cada pestaña, como en el wireframe (RF11)', () => {
    expect(componente.cantidadPestana('todas')).toBe(7);
    expect(componente.cantidadPestana('EN_CURSO')).toBe(2);
    expect(componente.cantidadPestana('PENDIENTE_DOCUMENTOS')).toBe(1);
    expect(componente.cantidadPestana('CERRADA')).toBe(3);

    expect(texto()).toContain('Pendientes de docs');
    expect(texto()).toContain('Cerradas');
  });

  it('filtra por estado al cambiar de pestaña (RF11)', async () => {
    componente.cambiarPestana('CERRADA');
    await tick();

    const peticion = http.expectOne(esPeticion('/visitas', 'GET'));
    expect(peticion.request.params.get('estado')).toBe('CERRADA');
    peticion.flush({ ...LISTA, datos: [], total: 0 });

    await tick();
    fixture.detectChanges();

    expect(componente.lista()?.total).toBe(0);
    expect(texto()).toContain('No hay visitas que coincidan con la búsqueda');
  });

  it('permite programar una visita con un predio nuevo (RF08)', async () => {
    expect(componente.puedeCrear()).toBe(true);

    componente.abrirNueva();
    componente.formulario.patchValue({
      modoPredio: 'nuevo',
      nombre: 'Granja La Esperanza',
      municipio: 'Chía',
      vereda: 'Vereda 2',
      tipoPredio: 'TRASPATIO',
      fecha: '2026-10-25',
      hora: '08:30',
      observaciones: 'Primera visita',
    });

    const guardado = componente.guardar();
    await tick();

    const envio = http.expectOne(esPeticion('/visitas/sincronizar', 'POST'));
    const operaciones = (
      envio.request.body as {
        operaciones: {
          crear?: { predio?: { nombre: string }; programadaPara: string };
        }[];
      }
    ).operaciones;

    expect(operaciones.length).toBe(1);
    expect(operaciones[0].crear?.predio?.nombre).toBe('Granja La Esperanza');
    expect(operaciones[0].crear?.programadaPara).toContain('2026-10-25');

    envio.flush({
      resultados: [{ id: 'operacion', estado: 'APLICADA' }],
      visitas: [],
    });

    // Primero se refresca la copia local y después se recarga la pantalla.
    await tick();
    http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);
    await tick();
    http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);

    await guardado;

    expect(componente.panelAbierto()).toBe(false);
  });

  it('avisa y sigue trabajando cuando no hay conexión (RF12)', async () => {
    componente.sincronizacion.enLinea.set(false);
    componente.cambiarPestana('todas');
    await tick();
    fixture.detectChanges();

    expect(texto()).toContain('Sin conexión');
    expect(texto()).toContain('se guardan en este equipo');
    // La lista sale de la copia del equipo, sin pedir al servidor.
    expect(componente.lista()?.total).toBe(7);
  });

  it('muestra cuántos registros hay sin sincronizar (RF12)', async () => {
    componente.sincronizacion.enLinea.set(false);
    await componente.sincronizacion.programar({
      predio: {
        nombre: 'Granja La Esperanza',
        municipio: 'Chía',
        vereda: 'Vereda 2',
        tipoPredio: 'TRASPATIO',
      },
      programadaPara: '2026-10-25T13:30:00.000Z',
    });
    await componente.cargar();
    fixture.detectChanges();

    expect(texto()).toContain('1 registro(s) sin sincronizar');
    expect(texto()).toContain('(sin sincronizar)');
    expect(componente.lista()?.datos[0].predio.nombre).toBe(
      'Granja La Esperanza',
    );
  });
});
