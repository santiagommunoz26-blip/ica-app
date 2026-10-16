import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { LoginComponent } from './login.component';
import { environment } from '../../../environments/environment';
import type { SesionRespuesta, Usuario } from '../../core/auth/auth.modelos';

const USUARIO: Usuario = {
  id: '11111111-1111-1111-1111-111111111111',
  nombreCompleto: 'Ana Ruiz',
  correo: 'ana.ruiz@entidad.gov.co',
  rol: 'ADMINISTRADOR',
  etiquetaRol: 'Administrador',
  estado: 'ACTIVO',
  debeCambiarPassword: false,
  tienePin: false,
  ultimoAcceso: null,
  createdAt: '2026-10-15T12:00:00.000Z',
  permisos: [],
};

const SESION: SesionRespuesta = {
  accessToken: 'token-de-acceso',
  refreshToken: 'token-de-refresco',
  expiraEnSegundos: 900,
  refreshExpiraEnSegundos: 604800,
  sesionInactividadMinutos: 30,
  usuario: USUARIO,
};

describe('LoginComponent (RF01, RF06, RF03)', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let componente: LoginComponent;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        // Mismo valor por defecto que la aplicación (app.config.ts).
        {
          provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
          useValue: { appearance: 'outline', floatLabel: 'always' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('muestra los rótulos flotando sobre el contorno (regresión visual)', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const etiqueta = raiz.querySelector(
      '.mat-mdc-floating-label',
    ) as HTMLElement;
    expect(etiqueta.className).toContain('mdc-floating-label--float-above');

    // La muesca del contorno no debe dibujar su borde derecho: Tailwind
    // (Preflight) aplica «border-style: solid» a todo y se veía una línea
    // vertical dentro de los campos (se corrige en styles.scss).
    const muesca = raiz.querySelector(
      '.mdc-notched-outline__notch',
    ) as HTMLElement;
    expect(getComputedStyle(muesca).borderRightWidth).toBe('0px');
  });

  it('exige correo y contraseña antes de llamar a la API', async () => {
    await componente.ingresar();

    http.expectNone(`${environment.apiUrl}/auth/login`);
    expect(componente.formulario.invalid).toBe(true);
  });

  it('muestra el panel de marca del wireframe', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Bienvenido de nuevo');
    expect(texto).toContain('Aves felices');
    expect(texto).toContain('Entrar con PIN');
  });

  it('rechaza un correo mal formado', async () => {
    componente.formulario.setValue({
      correo: 'no-es-un-correo',
      password: 'Definitiva2026*',
      recordarme: false,
    });

    await componente.ingresar();
    expect(componente.formulario.controls.correo.invalid).toBeTrue();
    http.expectNone(`${environment.apiUrl}/auth/login`);
  });

  it('ingresa y lleva al panel (RF01)', async () => {
    const navegar = spyOn(router, 'navigate').and.resolveTo(true);
    componente.formulario.setValue({
      correo: USUARIO.correo,
      password: 'Definitiva2026*',
      recordarme: true,
    });

    const promesa = componente.ingresar();
    const peticion = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(peticion.request.body).toEqual({
      correo: USUARIO.correo,
      password: 'Definitiva2026*',
      recordarme: true,
    });
    peticion.flush(SESION);
    await promesa;

    expect(navegar).toHaveBeenCalledWith(['/panel']);
  });

  it('lleva al cambio de contraseña si es temporal (RF07)', async () => {
    const navegar = spyOn(router, 'navigate').and.resolveTo(true);
    componente.formulario.setValue({
      correo: USUARIO.correo,
      password: 'Temporal2026*',
      recordarme: false,
    });

    const promesa = componente.ingresar();
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ ...SESION, usuario: { ...USUARIO, debeCambiarPassword: true } });
    await promesa;

    expect(navegar).toHaveBeenCalledWith(['/cambiar-password']);
  });

  it('muestra el mensaje de la API cuando las credenciales fallan (RF01)', async () => {
    componente.formulario.setValue({
      correo: USUARIO.correo,
      password: 'incorrecta',
      recordarme: false,
    });

    const promesa = componente.ingresar();
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush(
        { message: 'Correo o contraseña incorrectos.' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await promesa;

    expect(componente.error()).toBe('Correo o contraseña incorrectos.');
  });

  it('solicita el enlace de recuperación (RF06)', async () => {
    componente.recuperacionAbierta.set(true);
    componente.formularioRecuperacion.setValue({ correo: USUARIO.correo });

    const promesa = componente.enviarRecuperacion();
    http.expectOne(`${environment.apiUrl}/auth/recuperar-password`).flush({
      mensaje: 'Si el correo está registrado, recibirá las instrucciones.',
    });
    await promesa;

    expect(componente.recuperacionEnviada()).toBe(true);
  });

  it('no ofrece el PIN si no está configurado y lo ofrece si lo está (RF03)', () => {
    expect(componente.hayPin).toBe(false);

    localStorage.setItem(
      'ica.pin',
      JSON.stringify({
        correo: USUARIO.correo,
        sal: 'c2Fs',
        verificador: 'dmVy',
        iteraciones: 210000,
        intentosFallidos: 0,
        actualizadoEn: '2026-10-15T12:00:00.000Z',
      }),
    );

    const otro = TestBed.createComponent(LoginComponent).componentInstance;
    expect(otro.hayPin).toBe(true);
  });
});
