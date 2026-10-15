import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  type UrlSegment,
  type UrlTree,
} from '@angular/router';
import { AuthService } from './auth.service';
import { passwordVigenteGuard, rolGuard, sesionGuard } from './auth.guard';
import { PERMISOS, type Usuario } from './auth.modelos';

const USUARIO_ADMIN: Usuario = {
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
  permisos: [PERMISOS.USUARIOS_GESTIONAR],
};

/** Ruta mínima para probar los guardas. */
function rutaFalsa(
  data: Record<string, unknown> = {},
  url: string[] = [],
): ActivatedRouteSnapshot {
  return {
    data,
    url: url.map((segmento) => ({ path: segmento }) as UrlSegment),
  } as unknown as ActivatedRouteSnapshot;
}

const ESTADO_FALSO = {} as RouterStateSnapshot;

/** Crea el TestBed con un AuthService simulado. */
async function preparar(opciones: {
  autenticado: boolean;
  usuario?: Usuario | null;
  debeCambiar?: boolean;
}): Promise<void> {
  const usuario =
    opciones.usuario === undefined ? USUARIO_ADMIN : opciones.usuario;
  await TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          autenticado: () => opciones.autenticado,
          usuario: () => usuario,
          debeCambiarPassword: () => opciones.debeCambiar ?? false,
        },
      },
    ],
  }).compileComponents();
}

/** Extrae la ruta destino de un UrlTree. */
function rutaDe(resultado: boolean | UrlTree): string {
  return resultado instanceof Object && 'toString' in resultado
    ? resultado.toString()
    : String(resultado);
}

describe('Guardas de sesión y roles (RF01, RF04, RF07)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sesionGuard deja pasar con sesión y manda al ingreso sin ella (RF01)', async () => {
    await preparar({ autenticado: true });
    expect(
      TestBed.runInInjectionContext(() =>
        sesionGuard(rutaFalsa(), ESTADO_FALSO),
      ),
    ).toBe(true);

    TestBed.resetTestingModule();
    await preparar({ autenticado: false });
    const resultado = TestBed.runInInjectionContext(() =>
      sesionGuard(rutaFalsa({}, ['panel']), ESTADO_FALSO),
    );

    expect(rutaDe(resultado as UrlTree)).toContain('/login');
    expect(rutaDe(resultado as UrlTree)).toContain('destino');
  });

  it('passwordVigenteGuard obliga a cambiar la contraseña temporal (RF07)', async () => {
    await preparar({ autenticado: true, debeCambiar: true });
    const resultado = TestBed.runInInjectionContext(() =>
      passwordVigenteGuard(rutaFalsa(), ESTADO_FALSO),
    );

    expect(rutaDe(resultado as UrlTree)).toContain('/cambiar-password');
  });

  it('passwordVigenteGuard deja continuar cuando la contraseña ya se cambió', async () => {
    await preparar({ autenticado: true, debeCambiar: false });
    expect(
      TestBed.runInInjectionContext(() =>
        passwordVigenteGuard(rutaFalsa(), ESTADO_FALSO),
      ),
    ).toBe(true);
  });

  it('rolGuard permite el rol autorizado (RF04, RNF08)', async () => {
    await preparar({ autenticado: true });
    expect(
      TestBed.runInInjectionContext(() =>
        rolGuard(rutaFalsa({ roles: ['ADMINISTRADOR'] }), ESTADO_FALSO),
      ),
    ).toBe(true);
  });

  it('rolGuard expulsa al rol no autorizado (RF04, RNF08)', async () => {
    await preparar({
      autenticado: true,
      usuario: {
        ...USUARIO_ADMIN,
        rol: 'INSPECTOR',
        etiquetaRol: 'Inspector',
        permisos: [],
      },
    });
    const resultado = TestBed.runInInjectionContext(() =>
      rolGuard(rutaFalsa({ roles: ['ADMINISTRADOR'] }), ESTADO_FALSO),
    );

    expect(rutaDe(resultado as UrlTree)).toContain('/panel');
  });

  it('rolGuard deja pasar si la ruta no exige roles', async () => {
    await preparar({ autenticado: true });
    expect(
      TestBed.runInInjectionContext(() => rolGuard(rutaFalsa(), ESTADO_FALSO)),
    ).toBe(true);
  });
});
