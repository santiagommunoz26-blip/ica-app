import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { UsuariosComponent } from './usuarios.component';
import { environment } from '../../../environments/environment';
import type { RolCatalogo, Usuario } from '../../core/auth/auth.modelos';

const USUARIO: Usuario = {
  id: '22222222-2222-2222-2222-222222222222',
  nombreCompleto: 'Carlos Mejía',
  correo: 'carlos.mejia@entidad.gov.co',
  rol: 'INSPECTOR',
  etiquetaRol: 'Inspector',
  estado: 'ACTIVO',
  debeCambiarPassword: false,
  tienePin: false,
  ultimoAcceso: '2026-10-14T16:10:00.000Z',
  createdAt: '2026-10-01T12:00:00.000Z',
  permisos: [],
};

const CATALOGO: RolCatalogo[] = [
  {
    rol: 'ADMINISTRADOR',
    etiqueta: 'Administrador',
    permisos: [
      {
        clave: 'usuarios:gestionar',
        etiqueta: 'Gestionar usuarios',
        concedido: true,
      },
    ],
  },
  {
    rol: 'INSPECTOR',
    etiqueta: 'Inspector',
    permisos: [
      {
        clave: 'visitas:crear',
        etiqueta: 'Crear y programar visitas',
        concedido: true,
      },
      {
        clave: 'catalogo:editar',
        etiqueta: 'Editar catálogo de indicadores',
        concedido: false,
      },
    ],
  },
];

/** Predicado para localizar peticiones por ruta y método. */
const esPeticion =
  (ruta: string, metodo: string) =>
  (peticion: { url: string; method: string }) =>
    peticion.url.startsWith(`${environment.apiUrl}${ruta}`) &&
    peticion.method === metodo;

describe('UsuariosComponent (RF04, RF05)', () => {
  let fixture: ComponentFixture<UsuariosComponent>;
  let componente: UsuariosComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsuariosComponent],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsuariosComponent);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // Al iniciar carga la lista de usuarios y el catálogo de roles.
    http
      .expectOne(esPeticion('/usuarios', 'GET'))
      .flush({ datos: [USUARIO], total: 1, pagina: 1, porPagina: 10 });
    http.expectOne(esPeticion('/roles', 'GET')).flush(CATALOGO);

    // Deja que las respuestas se apliquen y refresca la vista.
    await new Promise((resolver) => setTimeout(resolver, 0));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('carga y muestra los usuarios con su rol y estado (RF05)', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(componente.usuarios().length).toBe(1);
    expect(texto).toContain('Carlos Mejía');
    expect(texto).toContain('carlos.mejia@entidad.gov.co');
    expect(texto).toContain('Inspector');
    expect(texto).toContain('Activo');
  });

  it('muestra los permisos del rol elegido, sin editarlos (RF04)', () => {
    componente.abrirNuevo();
    componente.formulario.controls.rol.setValue('INSPECTOR');

    const permisos = componente.permisosDelRol();

    expect(permisos.map((permiso) => permiso.clave)).toEqual([
      'visitas:crear',
      'catalogo:editar',
    ]);
    expect(permisos.find((p) => p.clave === 'catalogo:editar')?.concedido).toBe(
      false,
    );
  });

  it('crea un usuario y muestra la contraseña temporal una sola vez (RF05, RF07)', async () => {
    componente.abrirNuevo();
    componente.formulario.setValue({
      nombreCompleto: 'Laura Pineda',
      correo: 'laura.pineda@entidad.gov.co',
      rol: 'CONSULTA',
      passwordTemporal: '',
    });

    const promesa = componente.guardar();

    const creacion = http.expectOne(esPeticion('/usuarios', 'POST'));
    expect(creacion.request.body).toEqual(
      jasmine.objectContaining({
        nombreCompleto: 'Laura Pineda',
        correo: 'laura.pineda@entidad.gov.co',
        rol: 'CONSULTA',
      }),
    );
    creacion.flush({ usuario: USUARIO, passwordTemporal: 'Kf7mNp2qRs9t' });

    // Tras crear, se recarga la lista.
    await new Promise((resolver) => setTimeout(resolver, 0));
    http
      .expectOne(esPeticion('/usuarios', 'GET'))
      .flush({ datos: [USUARIO], total: 1, pagina: 1, porPagina: 10 });

    await promesa;

    expect(componente.credenciales()?.password).toBe('Kf7mNp2qRs9t');
    expect(componente.usuarios().length).toBe(1);
  });

  it('no crea usuarios con el formulario vacío', async () => {
    componente.abrirNuevo();

    await componente.guardar();

    http.expectNone(esPeticion('/usuarios', 'POST'));
    expect(componente.formulario.invalid).toBe(true);
  });

  it('inactiva un usuario (RF05)', async () => {
    const promesa = componente.cambiarEstado(USUARIO);

    const cambio = http.expectOne(
      esPeticion(`/usuarios/${USUARIO.id}/estado`, 'PATCH'),
    );
    expect(cambio.request.body).toEqual({ estado: 'INACTIVO' });
    cambio.flush({ ...USUARIO, estado: 'INACTIVO' });

    await new Promise((resolver) => setTimeout(resolver, 0));
    http
      .expectOne(esPeticion('/usuarios', 'GET'))
      .flush({ datos: [], total: 0, pagina: 1, porPagina: 10 });

    await promesa;
    expect(componente.usuarios().length).toBe(0);
  });

  it('muestra el error de la API si el correo ya existe (RF05)', async () => {
    componente.abrirNuevo();
    componente.formulario.setValue({
      nombreCompleto: 'Carlos Mejía',
      correo: USUARIO.correo,
      rol: 'INSPECTOR',
      passwordTemporal: '',
    });

    const promesa = componente.guardar();
    http
      .expectOne(esPeticion('/usuarios', 'POST'))
      .flush(
        { message: `Ya existe un usuario con el correo ${USUARIO.correo}.` },
        { status: 409, statusText: 'Conflict' },
      );
    await promesa;

    expect(componente.error()).toContain('Ya existe un usuario');
  });
});
