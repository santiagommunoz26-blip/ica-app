import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AlmacenRefrescoService } from './almacen-refresco.service';
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

  /**
   * Espera a que la aplicación haga una petición. Al entrar con el PIN primero
   * se verifica con PBKDF2 (cifrado local) y solo después se revalida la sesión.
   */
  async function esperarPeticion(url: string) {
    for (let intento = 0; intento < 200; intento += 1) {
      const [peticion] = http.match((candidata) => candidata.url === url);
      if (peticion) return peticion;
      await new Promise((resolver) => setTimeout(resolver, 25));
    }
    throw new Error(`La aplicación no pidió ${url}`);
  }

  /**
   * Espera a que el equipo guarde (cifrado) un token: la escritura pasa por
   * WebCrypto y no bloquea la promesa de la sesión.
   */
  async function esperarTokenGuardado(pin: string, token: string) {
    for (let intento = 0; intento < 100; intento += 1) {
      if ((await new AlmacenRefrescoService().desbloquear(pin)) === token)
        return;
      await new Promise((resolver) => setTimeout(resolver, 25));
    }
    throw new Error(`El equipo no guardó el token ${token}`);
  }

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

  it('entra sin conexión con el PIN: abre la sesión guardada (RF03)', async () => {
    localStorage.setItem('ica.perfil', JSON.stringify(USUARIO));
    localStorage.setItem(
      'ica.refresco',
      JSON.stringify({ v: 0, token: 'token-guardado' }),
    );
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);

    await servicio.entrarConPin('482913');

    expect(servicio.autenticado()).toBe(true);
    expect(servicio.sinConexion()).toBe(true);
  });

  it('con conexión revalida la sesión guardada al entrar con el PIN (RF03)', async () => {
    localStorage.setItem('ica.perfil', JSON.stringify(USUARIO));
    localStorage.setItem(
      'ica.refresco',
      JSON.stringify({ v: 0, token: 'token-guardado' }),
    );
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);

    const entrada = servicio.entrarConPin('482913');
    const renovacion = await esperarPeticion(
      `${environment.apiUrl}/auth/refresh`,
    );
    renovacion.flush(SESION);
    await entrada;

    expect(servicio.autenticado()).toBe(true);
    expect(servicio.sinConexion()).toBe(false);
  });

  it('abre con el PIN un token cifrado y lo deja cifrado en el equipo (RNF09)', async () => {
    localStorage.setItem('ica.perfil', JSON.stringify(USUARIO));
    await TestBed.inject(AlmacenRefrescoService).guardar(
      'token-cifrado',
      '482913',
    );
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);

    await servicio.entrarConPin('482913');

    expect(servicio.autenticado()).toBe(true);
    // El token sigue guardado cifrado: solo el PIN puede abrirlo.
    expect(JSON.parse(localStorage.getItem('ica.refresco') ?? '{}').v).toBe(1);
  });

  it('no entra con el PIN si el equipo no tiene una sesión guardada (RF03)', async () => {
    localStorage.setItem('ica.perfil', JSON.stringify(USUARIO));
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);

    await expectAsync(servicio.entrarConPin('482913')).toBeRejectedWithError(
      /No hay una sesión guardada/,
    );
    expect(servicio.autenticado()).toBe(false);
  });

  it('si el servidor rechaza la sesión guardada, la cierra y lo explica (RF02)', async () => {
    localStorage.setItem('ica.perfil', JSON.stringify(USUARIO));
    localStorage.setItem(
      'ica.refresco',
      JSON.stringify({ v: 0, token: 'token-vencido' }),
    );
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);

    const entrada = servicio.entrarConPin('482913');
    const renovacion = await esperarPeticion(
      `${environment.apiUrl}/auth/refresh`,
    );
    renovacion.flush(
      { message: 'La sesión no está activa.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await expectAsync(entrada).toBeRejectedWithError(/ya no está activa/);

    expect(servicio.autenticado()).toBe(false);
    expect(localStorage.getItem('ica.refresco')).toBeNull();
    expect(servicio.aviso()).toContain('sesión expiró');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login']);
  });

  it('si no hay red al revalidar, conserva la sesión y sigue sin conexión (RF12)', async () => {
    localStorage.setItem('ica.perfil', JSON.stringify(USUARIO));
    localStorage.setItem(
      'ica.refresco',
      JSON.stringify({ v: 0, token: 'token-guardado' }),
    );
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);

    const entrada = servicio.entrarConPin('482913');
    const renovacion = await esperarPeticion(
      `${environment.apiUrl}/auth/refresh`,
    );
    renovacion.error(new ProgressEvent('error'));
    await entrada;

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

  it('cierra la sesión y conserva el PIN y la credencial del equipo (RF02, RF03)', async () => {
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);

    const promesa = servicio.iniciarSesion({
      correo: USUARIO.correo,
      password: 'Definitiva2026*',
    });
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(SESION);
    await promesa;

    await servicio.cerrarSesion();

    // Con PIN el equipo queda habilitado: no se revoca ni se borra nada, para
    // poder volver a entrar con el PIN desde la pantalla de ingreso (RF03).
    http.expectNone(`${environment.apiUrl}/auth/logout`);
    expect(servicio.autenticado()).toBe(false);
    expect(localStorage.getItem('ica.refresco')).not.toBeNull();
    expect(servicio.hayPinEnEquipo()).toBe(true);
  });

  it('cierra la sesión sin PIN: revoca y borra el token del equipo (RF02)', async () => {
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
    expect(servicio.hayPinEnEquipo()).toBe(false);
  });

  it('al revalidar tras el PIN, el token rotado queda cifrado en el equipo (RNF09)', async () => {
    localStorage.setItem('ica.perfil', JSON.stringify(USUARIO));
    await TestBed.inject(AlmacenRefrescoService).guardar(
      'token-viejo',
      '482913',
    );
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);

    const entrada = servicio.entrarConPin('482913');
    const renovacion = await esperarPeticion(
      `${environment.apiUrl}/auth/refresh`,
    );
    renovacion.flush(SESION);
    await entrada;

    // El token rotado se guardó cifrado con la llave en memoria: antes se
    // descartaba y la recarga siguiente pedía la contraseña.
    await esperarTokenGuardado('482913', 'token-de-refresco');
    const crudo = localStorage.getItem('ica.refresco') ?? '';
    expect(crudo).not.toContain('token-de-refresco');
  });

  it('no entra con el PIN si el equipo quedó configurado para otro usuario (RF03)', async () => {
    localStorage.setItem(
      'ica.perfil',
      JSON.stringify({ ...USUARIO, correo: 'otro.usuario@entidad.gov.co' }),
    );
    const pinOffline = TestBed.inject(PinOfflineService);
    await pinOffline.guardar('482913', USUARIO.correo);

    await expectAsync(servicio.entrarConPin('482913')).toBeRejectedWithError(
      /otro usuario/,
    );
    expect(servicio.autenticado()).toBe(false);
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
