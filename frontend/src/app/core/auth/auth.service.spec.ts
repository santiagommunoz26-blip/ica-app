import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { PinOfflineService } from './pin-offline.service';
import { PERMISOS, type SesionRespuesta, type Usuario } from './auth.modelos';
import { environment } from '../../../environments/environment';

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
  permisos: [PERMISOS.USUARIOS_GESTIONAR, PERMISOS.CATALOGO_EDITAR],
};

const SESION: SesionRespuesta = {
  accessToken: 'token-de-acceso',
  refreshToken: 'token-de-refresco',
  expiraEnSegundos: 900,
  refreshExpiraEnSegundos: 604800,
  sesionInactividadMinutos: 30,
  usuario: USUARIO,
};

/**
 * Pruebas del servicio de autenticación (RF01, RF02, RF04, RF07).
 */
describe('AuthService', () => {
  let servicio: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    servicio = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    // Las pruebas no navegan de verdad: solo interesa que se pida la ruta.
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    // Cierra la sesión y responde la petición de cierre pendiente, si la hay.
    void servicio.cerrarSesion().catch(() => undefined);
    http.match(() => true).forEach((peticion) => peticion.flush({}));
    http.verify();
    localStorage.clear();
  });

  it('inicia sesión y guarda la sesión (RF01)', async () => {
    const promesa = servicio.iniciarSesion({
      correo: USUARIO.correo,
      password: 'Definitiva2026*',
    });
    const peticion = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(peticion.request.method).toBe('POST');
    peticion.flush(SESION);

    const usuario = await promesa;

    expect(usuario.correo).toBe(USUARIO.correo);
    expect(servicio.autenticado()).toBe(true);
    expect(servicio.tokenActual()).toBe('token-de-acceso');
    expect(servicio.minutosDeInactividad()).toBe(30);
    // El token de refresco es lo único que se escribe en el equipo (RF02, RF03).
    // Sin PIN en el equipo se guarda en claro, identificado con su versión.
    expect(JSON.parse(localStorage.getItem('ica.refresco') ?? '{}')).toEqual({
      v: 0,
      token: 'token-de-refresco',
    });
  });

  it('reconoce los permisos del rol (RF04)', async () => {
    const promesa = servicio.iniciarSesion({
      correo: USUARIO.correo,
      password: 'Definitiva2026*',
    });
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(SESION);
    await promesa;

    expect(servicio.puede(PERMISOS.USUARIOS_GESTIONAR)).toBe(true);
    expect(servicio.puede(PERMISOS.VISITAS_CREAR)).toBe(false);
  });

  it('avisa cuando la contraseña es temporal (RF07)', async () => {
    const promesa = servicio.iniciarSesion({
      correo: USUARIO.correo,
      password: 'Temporal2026*',
    });
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ ...SESION, usuario: { ...USUARIO, debeCambiarPassword: true } });

    await promesa;
    expect(servicio.debeCambiarPassword()).toBe(true);
  });

  it('restaura la sesión con el token de refresco (RF02)', async () => {
    localStorage.setItem(
      'ica.refresco',
      JSON.stringify({ v: 0, token: 'token-guardado' }),
    );

    const promesa = servicio.restaurarSesion();
    const peticion = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(peticion.request.body).toEqual({ token: 'token-guardado' });
    peticion.flush(SESION);

    await promesa;
    expect(servicio.autenticado()).toBe(true);
    expect(servicio.usuario()?.correo).toBe(USUARIO.correo);
  });

  it('con el token cifrado pide el PIN en vez de renovar en silencio (RNF09)', async () => {
    localStorage.setItem(
      'ica.refresco',
      JSON.stringify({
        v: 1,
        sal: 'c2Fs',
        iv: 'aXY=',
        datos: 'ZGF0b3M=',
      }),
    );

    await servicio.restaurarSesion();

    expect(servicio.autenticado()).toBe(false);
    // El token cifrado no se borra: se podrá abrir con el PIN.
    expect(localStorage.getItem('ica.refresco')).not.toBeNull();
  });

  it('sin conexión conserva el perfil para poder entrar con el PIN (RF03)', async () => {
    localStorage.setItem(
      'ica.refresco',
      JSON.stringify({ v: 0, token: 'token-guardado' }),
    );
    localStorage.setItem('ica.perfil', JSON.stringify(USUARIO));

    const promesa = servicio.restaurarSesion();
    http
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .error(new ProgressEvent('error'));

    await promesa;
    expect(servicio.usuario()?.correo).toBe(USUARIO.correo);
    expect(servicio.sinConexion()).toBe(false);
  });

  it('entra sin conexión con el PIN correcto (RF03)', async () => {
    localStorage.setItem('ica.perfil', JSON.stringify(USUARIO));
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);

    await servicio.entrarConPin('482913');

    expect(servicio.autenticado()).toBe(true);
    expect(servicio.sinConexion()).toBe(true);
  });

  it('rechaza un PIN incorrecto y lo informa con los intentos restantes (RF03)', async () => {
    localStorage.setItem('ica.perfil', JSON.stringify(USUARIO));
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);

    await expectAsync(servicio.entrarConPin('000000')).toBeRejectedWithError(
      /PIN incorrecto/,
    );
    expect(servicio.autenticado()).toBe(false);
  });

  it('cierra la sesión y borra el token del equipo (RF02)', async () => {
    const promesa = servicio.iniciarSesion({
      correo: USUARIO.correo,
      password: 'Definitiva2026*',
    });
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(SESION);
    await promesa;

    const cierre = servicio.cerrarSesion();
    http
      .expectOne(`${environment.apiUrl}/auth/logout`)
      .flush({ mensaje: 'Sesión cerrada.' });
    await cierre;

    expect(servicio.autenticado()).toBe(false);
    expect(localStorage.getItem('ica.refresco')).toBeNull();
  });

  it('cambia la contraseña y recarga el perfil (RF07)', async () => {
    const promesa = servicio.iniciarSesion({
      correo: USUARIO.correo,
      password: 'Temporal2026*',
    });
    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ ...SESION, usuario: { ...USUARIO, debeCambiarPassword: true } });
    await promesa;

    const cambio = servicio.cambiarPassword('Temporal2026*', 'Definitiva2026*');
    const peticionCambio = http.expectOne(
      `${environment.apiUrl}/auth/cambiar-password`,
    );
    expect(peticionCambio.request.body).toEqual({
      passwordActual: 'Temporal2026*',
      passwordNueva: 'Definitiva2026*',
    });
    peticionCambio.flush({ mensaje: 'Contraseña actualizada correctamente.' });

    // La recarga del perfil se pide justo después de responder el cambio.
    await new Promise((resolver) => setTimeout(resolver, 0));
    const perfil = http.expectOne(`${environment.apiUrl}/auth/perfil`);
    perfil.flush({
      usuario: { ...USUARIO, debeCambiarPassword: false },
      sesionInactividadMinutos: 30,
    });

    await cambio;
    expect(servicio.debeCambiarPassword()).toBe(false);
  });
});
