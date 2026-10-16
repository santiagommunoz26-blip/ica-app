import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import type { SesionRespuesta, Usuario } from '../auth/auth.modelos';
import type { PeticionGuardarInspeccion } from '../inspeccion/inspeccion.modelos';
import { SincronizacionService } from './sincronizacion.service';
import type { ListaVisitas, Visita } from './visitas.modelos';

const USUARIO: Usuario = {
  id: '33333333-3333-3333-3333-333333333333',
  nombreCompleto: 'Ana Ruiz',
  correo: 'ana.ruiz@entidad.gov.co',
  rol: 'INSPECTOR',
  etiquetaRol: 'Inspector',
  estado: 'ACTIVO',
  debeCambiarPassword: false,
  tienePin: false,
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

const VISITA: Visita = {
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
};

const LISTA: ListaVisitas = {
  datos: [VISITA],
  total: 1,
  pagina: 1,
  porPagina: 20,
  conteos: {
    todas: 1,
    programadas: 1,
    enCurso: 0,
    pendientesDocumentos: 0,
    cerradas: 0,
  },
};

const NUEVA = {
  predio: {
    nombre: 'Granja La Esperanza',
    municipio: 'Chía',
    vereda: 'Vereda 2',
    tipoPredio: 'TRASPATIO' as const,
  },
  programadaPara: '2026-10-25T13:00:00.000Z',
};

/** Ficha con evaluación y documento: llevan `guardadoEn`, solo de pantalla. */
const FICHA: PeticionGuardarInspeccion = {
  nombrePredio: 'Granja El Rosal',
  municipio: 'Sopó',
  vereda: 'Vereda 1',
  observaciones: 'Prueba',
  evaluaciones: [
    {
      galponNumero: 1,
      indicadorCodigo: 'MBA-01',
      noAplica: false,
      motivoNoAplica: null,
      observaciones: 'Prueba de M4',
      puntos: [{ numero: 1, puntaje: 2, aves: 20, jaulas: null }],
      guardadoEn: '2026-10-16T14:54:30.014Z',
    },
  ],
  documentos: [
    {
      indicadorCodigo: 'MBG-04',
      presentado: true,
      legible: true,
      firmadoResponsable: true,
      firmadoProfesional: null,
      mortalidad: 7.5,
      puntaje: 2,
      pendiente: false,
      guardadoEn: '2026-10-16T15:00:00.000Z',
    },
  ],
};

const esPeticion =
  (ruta: string, metodo: string) =>
  (peticion: { url: string; method: string }) =>
    peticion.url.startsWith(`${environment.apiUrl}${ruta}`) &&
    peticion.method === metodo;

/** Deja avanzar las promesas de la petición que se acaba de emitir. */
const tick = () => new Promise((resolver) => setTimeout(resolver, 0));

/**
 * Trabajo sin conexión (RF12): los cambios se guardan primero en el equipo, se
 * envían al volver la red y el panel informa cuántos quedan pendientes.
 */
describe('SincronizacionService', () => {
  let servicio: SincronizacionService;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);

    // Sesión activa: así las consultas no piden renovación del token.
    const promesa = auth.iniciarSesion({
      correo: USUARIO.correo,
      password: 'Definitiva2026*',
    });
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(SESION);
    await promesa;

    servicio = TestBed.inject(SincronizacionService);
  });

  afterEach(() => {
    localStorage.clear();
    http.verify();
  });

  it('guarda la visita en el equipo cuando no hay conexión (RF12)', async () => {
    servicio.enLinea.set(false);

    const resultado = await servicio.programar(NUEVA);

    expect(resultado.pendiente).toBe(true);
    expect(resultado.rechazos).toEqual([]);
    expect(servicio.pendientes()).toBe(1);

    const cola = JSON.parse(
      localStorage.getItem('ica.visitas.cola') ?? '[]',
    ) as { tipo: string }[];
    expect(cola.length).toBe(1);
    expect(cola[0].tipo).toBe('CREAR_VISITA');
  });

  it('envía de inmediato lo programado cuando hay conexión', async () => {
    const promesa = servicio.programar(NUEVA);
    await tick();

    const envio = http.expectOne(esPeticion('/visitas/sincronizar', 'POST'));
    const operaciones = (
      envio.request.body as {
        operaciones: { id: string; tipo: string; resumen?: string }[];
      }
    ).operaciones;
    expect(operaciones.length).toBe(1);
    expect(operaciones[0].tipo).toBe('CREAR_VISITA');
    // El resumen es solo para la pantalla: no se le envía al servidor.
    expect(operaciones[0].resumen).toBeUndefined();

    envio.flush({
      resultados: [{ id: operaciones[0].id, estado: 'APLICADA' }],
      visitas: [],
    });
    await tick();
    http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);

    const resultado = await promesa;

    expect(resultado.pendiente).toBe(false);
    expect(servicio.pendientes()).toBe(0);
  });

  it('informa las operaciones que el servidor rechaza (RF12)', async () => {
    const promesa = servicio.programar(NUEVA);
    await tick();

    const envio = http.expectOne(esPeticion('/visitas/sincronizar', 'POST'));
    const operacion = (envio.request.body as { operaciones: { id: string }[] })
      .operaciones[0];
    envio.flush({
      resultados: [
        {
          id: operacion.id,
          estado: 'RECHAZADA',
          motivo: 'La visita ya está cerrada.',
        },
      ],
      visitas: [],
    });
    await tick();
    http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);

    const resultado = await promesa;

    expect(resultado.rechazos).toEqual(['La visita ya está cerrada.']);
    // Un rechazo no se reintenta: sale de la cola.
    expect(servicio.pendientes()).toBe(0);
  });

  it('muestra en la lista lo que está pendiente de enviar (RF12)', async () => {
    servicio.enLinea.set(false);
    await servicio.programar(NUEVA);

    const lista = await servicio.listar({});

    expect(lista.datos[0].predio.nombre).toBe('Granja La Esperanza');
    expect(lista.datos[0].pendiente).toBe(true);
    expect(lista.total).toBe(1);
    expect(lista.conteos.todas).toBe(1);
  });

  it('refleja el cambio de estado sobre la copia del equipo (RF09, RF12)', async () => {
    servicio.enLinea.set(false);
    servicio.listaLocal.set(LISTA);

    await servicio.cambiarEstado(VISITA, 'EN_CURSO');
    const lista = await servicio.listar({});

    expect(lista.datos[0].estado).toBe('EN_CURSO');
    expect(lista.datos[0].etiquetaEstado).toBe('En curso');
    expect(lista.datos[0].pendiente).toBe(true);
  });

  it('envía solo los pendientes cuando vuelve la conexión (RF12)', async () => {
    servicio.enLinea.set(false);
    await servicio.programar(NUEVA);
    expect(servicio.pendientes()).toBe(1);

    window.dispatchEvent(new Event('online'));
    expect(servicio.enLinea()).toBe(true);

    await tick();
    const envio = http.expectOne(esPeticion('/visitas/sincronizar', 'POST'));
    const operacion = (envio.request.body as { operaciones: { id: string }[] })
      .operaciones[0];
    envio.flush({
      resultados: [{ id: operacion.id, estado: 'APLICADA' }],
      visitas: [],
    });
    await tick();
    http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);

    await tick();
    expect(servicio.pendientes()).toBe(0);
  });

  it('sin conexión no intenta sincronizar', async () => {
    servicio.enLinea.set(false);
    await servicio.programar(NUEVA);

    const resultados = await servicio.sincronizar();

    expect(resultados).toEqual([]);
    expect(servicio.pendientes()).toBe(1);
  });

  it('la ficha que se envía no lleva los campos de pantalla (RF12, RNF09)', async () => {
    servicio.enLinea.set(false);
    await servicio.guardarInspeccion(VISITA.id, FICHA);
    expect(servicio.pendientes()).toBe(1);

    servicio.enLinea.set(true);
    const promesa = servicio.sincronizar();
    await tick();

    const envio = http.expectOne(esPeticion('/visitas/sincronizar', 'POST'));
    // `guardadoEn` es solo para la pantalla: el servidor rechazaría el lote.
    expect(JSON.stringify(envio.request.body)).not.toContain('guardadoEn');
    const operacion = (
      envio.request.body as {
        operaciones: {
          id: string;
          inspeccion: {
            evaluaciones: Record<string, unknown>[];
            documentos: Record<string, unknown>[];
          };
        }[];
      }
    ).operaciones[0];
    expect(operacion.inspeccion.evaluaciones[0]['galponNumero']).toBe(1);
    expect(operacion.inspeccion.documentos[0]['indicadorCodigo']).toBe(
      'MBG-04',
    );

    envio.flush({
      resultados: [{ id: operacion.id, estado: 'APLICADA' }],
      visitas: [],
    });
    await tick();
    http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);
    await promesa;

    expect(servicio.pendientes()).toBe(0);
  });

  it('una operación mal formada no bloquea a las demás (RF12)', async () => {
    servicio.enLinea.set(false);
    await servicio.cambiarEstado(VISITA, 'EN_CURSO');
    await servicio.cambiarEstado(VISITA, 'PENDIENTE_DOCUMENTOS');
    expect(servicio.pendientes()).toBe(2);

    servicio.enLinea.set(true);
    const promesa = servicio.sincronizar();
    await tick();

    // El servidor rechaza el lote entero por el formato de una operación…
    const lote = http.expectOne(esPeticion('/visitas/sincronizar', 'POST'));
    expect(
      (lote.request.body as { operaciones: unknown[] }).operaciones.length,
    ).toBe(2);
    lote.flush(
      { message: ['property inesperada should not exist'], statusCode: 400 },
      { status: 400, statusText: 'Bad Request' },
    );
    await tick();

    // …así que se reintenta una por una: la primera sigue mal formada y la
    // segunda sí se aplica.
    const primera = http.expectOne(esPeticion('/visitas/sincronizar', 'POST'));
    const idPrimera = (
      primera.request.body as { operaciones: { id: string }[] }
    ).operaciones[0].id;
    primera.flush(
      { message: ['property inesperada should not exist'], statusCode: 400 },
      { status: 400, statusText: 'Bad Request' },
    );
    await tick();

    const segunda = http.expectOne(esPeticion('/visitas/sincronizar', 'POST'));
    const idSegunda = (
      segunda.request.body as { operaciones: { id: string }[] }
    ).operaciones[0].id;
    segunda.flush({
      resultados: [{ id: idSegunda, estado: 'APLICADA' }],
      visitas: [],
    });
    await tick();

    http.expectOne(esPeticion('/visitas', 'GET')).flush(LISTA);
    const resultados = await promesa;

    expect(idPrimera).not.toBe(idSegunda);
    expect(resultados.length).toBe(2);
    expect(resultados[0].estado).toBe('RECHAZADA');
    expect(resultados[0].motivo).toContain('formato');
    expect(resultados[1].estado).toBe('APLICADA');
    // Las dos salen de la cola: la mal formada ya no se reintenta sola.
    expect(servicio.pendientes()).toBe(0);
  });
});
