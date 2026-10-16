import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  map,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AlmacenRefrescoService } from './almacen-refresco.service';
import { PinOfflineService } from './pin-offline.service';
import type {
  Permiso,
  PeticionIniciarSesion,
  SesionRespuesta,
  Usuario,
} from './auth.modelos';
import { tienePermiso } from './auth.modelos';

const CLAVE_PERFIL = 'ica.perfil';
/** Tiempo mínimo entre reinicios del temporizador de inactividad. */
const ESPERA_ENTRE_REINICIOS_MS = 30_000;

/** Estado de la sesión activa. */
interface EstadoSesion {
  usuario: Usuario;
  sesionInactividadMinutos: number;
}

/**
 * Autenticación y sesión (M1 · RF01–RF04, RF07).
 *
 * Almacenamiento de tokens (RNF09, decidido en M2):
 * - el token de acceso vive **en memoria** (no se escribe en disco);
 * - el token de refresco se guarda en el equipo porque es lo único que permite
 *   recuperar la sesión al recargar o entrar sin conexión (RF03), y se guarda
 *   **cifrado con el PIN** cuando el equipo tiene PIN (`AlmacenRefrescoService`).
 *   Mientras la aplicación está abierta la llave vive en memoria, así que las
 *   renovaciones no vuelven a pedir el PIN.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly pinOffline = inject(PinOfflineService);
  private readonly almacen = inject(AlmacenRefrescoService);

  private readonly estado = signal<EstadoSesion | null>(null);
  /** Mensaje para mostrar en la pantalla de inicio de sesión. */
  readonly aviso = signal<string | null>(null);
  /** Verdadero cuando se entró con PIN y no hay conexión (RF03). */
  readonly sinConexion = signal(false);

  private accessToken: string | null = null;
  private temporizador?: ReturnType<typeof setTimeout>;
  private ultimoReinicio = 0;
  private renovacionEnCurso$?: Observable<string>;
  private escuchandoActividad = false;
  private readonly alDetectarActividad = (): void =>
    this.reiniciarInactividad();

  /** Usuario de la sesión, o null. */
  readonly usuario = computed(() => this.estado()?.usuario ?? null);
  /** ¿Hay sesión activa? */
  readonly autenticado = computed(() => this.estado() !== null);
  /** ¿Debe cambiar la contraseña temporal en este primer acceso? (RF07) */
  readonly debeCambiarPassword = computed(
    () => this.estado()?.usuario.debeCambiarPassword ?? false,
  );
  /** Minutos de inactividad configurados (RF02). */
  readonly minutosDeInactividad = computed(
    () => this.estado()?.sesionInactividadMinutos ?? 0,
  );
  /** ¿El usuario de la sesión tiene un permiso concreto? (RF04) */
  puede(permiso: Permiso): boolean {
    return tienePermiso(this.usuario(), permiso);
  }

  // ------------------------------------------------------------- sesión

  /** Inicia sesión con correo y contraseña (RF01). */
  async iniciarSesion(peticion: PeticionIniciarSesion): Promise<Usuario> {
    const sesion = await firstValueFrom(
      this.http.post<SesionRespuesta>(
        `${environment.apiUrl}/auth/login`,
        peticion,
      ),
    );
    this.aplicarSesion(sesion);
    return sesion.usuario;
  }

  /**
   * Restaura la sesión al abrir la aplicación: si hay token de refresco se
   * renueva; si el equipo tiene PIN, la sesión se recupera entrando con el PIN
   * (RNF09); y si no hay conexión se conserva el perfil para poder entrar con
   * el PIN (RF03).
   */
  async restaurarSesion(): Promise<void> {
    // Con el token cifrado no se puede renovar en silencio: se deja el perfil
    // para que la pantalla de ingreso ofrezca «Entrar con PIN».
    if (this.almacen.bloqueadoPorPin()) return;

    const refresco = this.almacen.leer();
    if (!refresco) {
      this.limpiarSesion();
      return;
    }

    try {
      const sesion = await firstValueFrom(
        this.http.post<SesionRespuesta>(`${environment.apiUrl}/auth/refresh`, {
          token: refresco,
        }),
      );
      this.aplicarSesion(sesion);
    } catch (error) {
      const sinRed = error instanceof HttpErrorResponse && error.status === 0;
      const perfil = this.leerPerfilCacheado();
      if (sinRed && perfil) {
        // Sin conexión: se deja el perfil cacheado para el acceso con PIN.
        this.estado.set({ usuario: perfil, sesionInactividadMinutos: 0 });
      } else {
        this.limpiarSesion();
        this.aviso.set('Su sesión expiró. Ingrese de nuevo.');
      }
    }
  }

  /**
   * Cierra la sesión de uso (RF02).
   *
   * En un equipo **con PIN**, el equipo conserva su credencial (el token de
   * refresco cifrado y el PIN): el ingreso con PIN sigue disponible después de
   * cerrar sesión, también sin conexión (RF03). En un equipo **sin PIN** el
   * cierre es total: se revoca la sesión ante el servidor y se borra el token
   * del equipo, porque nadie más lo protege.
   */
  async cerrarSesion(): Promise<void> {
    if (this.pinOffline.hayPin()) {
      this.soltarSesion();
    } else {
      const refresco = this.almacen.leer();
      try {
        if (refresco && this.accessToken) {
          await firstValueFrom(
            this.http.post(`${environment.apiUrl}/auth/logout`, {
              token: refresco,
            }),
          );
        }
      } catch {
        // Aunque la API falle, la sesión local se cierra igual.
      }
      this.limpiarSesion();
    }
    await this.router.navigate(['/login']);
  }

  /** Renueva el token de acceso; comparte una sola petición en curso (RF02). */
  renovarToken(): Observable<string> {
    this.renovacionEnCurso$ ??= this.http
      .post<SesionRespuesta>(`${environment.apiUrl}/auth/refresh`, {
        token: this.almacen.leer(),
      })
      .pipe(
        tap((sesion) => this.aplicarSesion(sesion)),
        map((sesion) => sesion.accessToken),
        catchError((error: unknown) => {
          // Un fallo de red no cierra la sesión: se sigue trabajando sin
          // conexión (RF12). Si el servidor sí respondió y rechazó la sesión,
          // no hay nada que renovar: se cierra y se pide ingresar de nuevo.
          const sinRed =
            error instanceof HttpErrorResponse && error.status === 0;
          if (!sinRed) {
            this.limpiarSesion();
            this.aviso.set('Su sesión expiró. Ingrese de nuevo.');
            void this.router.navigate(['/login']);
          }
          return throwError(() => error);
        }),
        finalize(() => {
          this.renovacionEnCurso$ = undefined;
        }),
        shareReplay(1),
      );
    return this.renovacionEnCurso$;
  }

  /** Token de acceso actual (para el interceptor). */
  tokenActual(): string | null {
    return this.accessToken;
  }

  /**
   * Garantiza un token de acceso antes de llamar a la API: si no hay ninguno
   * (por ejemplo, tras entrar con el PIN y recuperar la conexión) lo renueva.
   */
  asegurarAcceso(): Observable<string> {
    const actual = this.accessToken;
    if (actual) return of(actual);
    return this.renovarToken();
  }

  /** ¿La petición es de autenticación (no debe reintentarse con refresco)? */
  esRutaDeAutenticacion(url: string): boolean {
    return (
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/recuperar-password') ||
      url.includes('/auth/restablecer-password')
    );
  }

  /** Recarga el perfil (por ejemplo, tras cambiar la contraseña). */
  async cargarPerfil(): Promise<Usuario> {
    const respuesta = await firstValueFrom(
      this.http.get<{ usuario: Usuario; sesionInactividadMinutos: number }>(
        `${environment.apiUrl}/auth/perfil`,
      ),
    );
    this.estado.set(respuesta);
    this.guardarPerfilCacheado(respuesta.usuario);
    this.reiniciarInactividad();
    return respuesta.usuario;
  }

  // ------------------------------------------------- contraseñas (RF06/RF07)

  /** Cambia la contraseña del usuario de la sesión (RF07). */
  async cambiarPassword(
    passwordActual: string,
    passwordNueva: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/auth/cambiar-password`, {
        passwordActual,
        passwordNueva,
      }),
    );
    await this.cargarPerfil();
  }

  /** Solicita el enlace de recuperación por correo (RF06). */
  solicitarRecuperacion(correo: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(
      `${environment.apiUrl}/auth/recuperar-password`,
      { correo },
    );
  }

  /** Restablece la contraseña con el token del correo (RF06). */
  async restablecerPassword(
    token: string,
    passwordNueva: string,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/auth/restablecer-password`, {
        token,
        passwordNueva,
      }),
    );
  }

  // ------------------------------------------------------- PIN (RF03)

  /** Configura en la API y en el equipo el PIN de acceso sin conexión. */
  async configurarPin(pin: string, passwordActual: string): Promise<void> {
    await firstValueFrom(
      this.http.put(`${environment.apiUrl}/auth/pin`, { pin, passwordActual }),
    );
    await this.pinOffline.guardar(pin, this.usuario()?.correo ?? '');
    // A partir de aquí el token guardado en el equipo queda cifrado con el PIN
    // (RNF09): sin el PIN no se puede recuperar la sesión.
    await this.almacen.reCifrarConPin(pin);
    await this.cargarPerfil();
  }

  /**
   * Entra con el PIN del equipo (RF03). La comprobación es local.
   *
   * El PIN abre la **sesión guardada** en el equipo (RNF09): descifra el token
   * y, cuando hay conexión, la revalida contra el servidor; si no hay red, la
   * aplicación queda marcada como «sin conexión» y se trabaja con los datos
   * guardados (RF12). Sin una sesión guardada no hay nada que abrir: se pide
   * ingresar con la contraseña.
   */
  async entrarConPin(pin: string): Promise<void> {
    const perfil = this.leerPerfilCacheado();
    if (!perfil) {
      throw new Error('No hay una sesión anterior en este equipo.');
    }
    const correoDelPin = this.pinOffline.correoDelPin();
    if (correoDelPin && correoDelPin !== perfil.correo) {
      // El PIN pertenece a otro usuario del equipo: no se mezclan sesiones.
      throw new Error(
        'El PIN de este equipo pertenece a otro usuario. Ingrese con su contraseña.',
      );
    }
    if (this.pinOffline.bloqueado()) {
      throw new Error('El PIN está bloqueado. Ingrese con su contraseña.');
    }
    const correcto = await this.pinOffline.verificar(pin);
    if (!correcto) {
      const restantes = this.pinOffline.intentosRestantes();
      throw new Error(
        restantes > 0
          ? `PIN incorrecto. Le quedan ${restantes} intento(s).`
          : 'PIN incorrecto. El acceso con PIN quedó bloqueado.',
      );
    }

    await this.almacen.desbloquear(pin);
    if (!this.almacen.leer()) {
      throw new Error(
        'No hay una sesión guardada en este equipo para entrar sin conexión. Ingrese con su contraseña.',
      );
    }

    this.estado.set({ usuario: perfil, sesionInactividadMinutos: 0 });
    this.sinConexion.set(true);

    if (navigator.onLine) {
      try {
        await firstValueFrom(this.renovarToken());
        this.sinConexion.set(false);
      } catch {
        // Si el servidor rechazó la sesión, `renovarToken` ya la cerró y dejó
        // su aviso: aquí solo se explica en la pantalla de ingreso.
        if (!this.autenticado()) {
          throw new Error(
            'La sesión guardada ya no está activa. Ingrese con su contraseña.',
          );
        }
        // Sin red el PIN vale igual: se sigue trabajando sin conexión (RF12).
      }
    }
  }

  /** ¿Hay PIN configurado en este equipo? (RF03) */
  hayPinEnEquipo(): boolean {
    return this.pinOffline.hayPin();
  }

  /** Quita el aviso de la pantalla de inicio de sesión. */
  limpiarAviso(): void {
    this.aviso.set(null);
  }

  // ----------------------------------------------------------- internos

  private aplicarSesion(sesion: SesionRespuesta): void {
    this.accessToken = sesion.accessToken;
    // El token de refresco se persiste cifrado si el equipo tiene PIN (RNF09);
    // la escritura es asíncrona y no bloquea el ingreso.
    void this.almacen.guardar(sesion.refreshToken);
    this.guardarPerfilCacheado(sesion.usuario);
    this.estado.set({
      usuario: sesion.usuario,
      sesionInactividadMinutos: sesion.sesionInactividadMinutos,
    });
    this.sinConexion.set(false);
    this.aviso.set(null);
    this.iniciarVigilanciaDeActividad(sesion.sesionInactividadMinutos);
  }

  private limpiarSesion(): void {
    this.accessToken = null;
    this.estado.set(null);
    this.sinConexion.set(false);
    this.almacen.borrar();
    this.detenerVigilanciaDeActividad();
  }

  /**
   * Suelta la sesión activa sin destruir la credencial del equipo (RF03): el
   * token guardado (cifrado con el PIN o en claro) y el perfil cacheado se
   * conservan para volver a entrar renovando o con el PIN.
   */
  private soltarSesion(): void {
    this.accessToken = null;
    this.estado.set(null);
    this.sinConexion.set(false);
    this.detenerVigilanciaDeActividad();
  }

  /** Cierra la sesión por inactividad (RF02). */
  private cerrarPorInactividad(): void {
    // Es un cierre local: la credencial del equipo se conserva para poder
    // volver a entrar (renovando o con el PIN; sin ella, el trabajo de campo
    // sin internet quedaría bloqueado, RF03/RF12).
    this.soltarSesion();
    this.aviso.set(
      'La sesión se cerró por inactividad. Ingrese de nuevo para continuar.',
    );
    void this.router.navigate(['/login']);
  }

  private iniciarVigilanciaDeActividad(minutos: number): void {
    this.detenerVigilanciaDeActividad();
    if (minutos <= 0) return;

    ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(
      (evento) =>
        document.addEventListener(evento, this.alDetectarActividad, {
          passive: true,
        }),
    );
    this.escuchandoActividad = true;
    this.programarCierre(minutos);
  }

  private detenerVigilanciaDeActividad(): void {
    if (this.escuchandoActividad) {
      ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach(
        (evento) =>
          document.removeEventListener(evento, this.alDetectarActividad),
      );
      this.escuchandoActividad = false;
    }
    if (this.temporizador) {
      clearTimeout(this.temporizador);
      this.temporizador = undefined;
    }
  }

  /** Reinicia el contador de inactividad (como mucho cada 30 s). */
  private reiniciarInactividad(): void {
    const minutos = this.minutosDeInactividad();
    if (!this.autenticado() || minutos <= 0) return;

    const ahora = Date.now();
    if (ahora - this.ultimoReinicio < ESPERA_ENTRE_REINICIOS_MS) return;
    this.programarCierre(minutos);
  }

  private programarCierre(minutos: number): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.ultimoReinicio = Date.now();
    this.temporizador = setTimeout(
      () => this.cerrarPorInactividad(),
      minutos * 60_000,
    );
  }

  private guardarPerfilCacheado(usuario: Usuario): void {
    this.escribirAlmacen(CLAVE_PERFIL, JSON.stringify(usuario));
  }

  private leerPerfilCacheado(): Usuario | null {
    const crudo = this.leerAlmacen(CLAVE_PERFIL);
    if (!crudo) return null;
    try {
      return JSON.parse(crudo) as Usuario;
    } catch {
      return null;
    }
  }

  private leerAlmacen(clave: string): string | null {
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  }

  private escribirAlmacen(clave: string, valor: string): void {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      // Sin almacenamiento disponible la sesión no persiste, pero se puede usar.
    }
  }

  private borrarAlmacen(clave: string): void {
    try {
      localStorage.removeItem(clave);
    } catch {
      // Nada que hacer.
    }
  }
}
