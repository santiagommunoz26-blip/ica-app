import { TestBed } from '@angular/core/testing';
import { AlmacenRefrescoService } from './almacen-refresco.service';

/**
 * Token de refresco en el equipo (RNF09): con PIN se guarda cifrado y sin el
 * PIN no se puede leer; sin PIN queda en claro (limitación conocida).
 */
describe('AlmacenRefrescoService', () => {
  let servicio: AlmacenRefrescoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(AlmacenRefrescoService);
  });

  afterEach(() => localStorage.clear());

  it('sin PIN guarda el token en claro', async () => {
    await servicio.guardar('token-1');

    expect(servicio.bloqueadoPorPin()).toBe(false);
    expect(servicio.leer()).toBe('token-1');
    expect(localStorage.getItem('ica.refresco')).toContain('token-1');
  });

  it('con PIN cifra el token: no queda en claro en el equipo', async () => {
    await servicio.guardar('token-secreto', '482913');

    const guardado = localStorage.getItem('ica.refresco') ?? '';
    expect(guardado).not.toContain('token-secreto');
    expect(guardado).toContain('"v":1');
    expect(servicio.bloqueadoPorPin()).toBe(true);
  });

  it('una sesión nueva no puede leer el token cifrado sin el PIN', async () => {
    await servicio.guardar('token-secreto', '482913');

    // Otra instancia equivale a volver a abrir la aplicación.
    const otra = new AlmacenRefrescoService();

    expect(otra.bloqueadoPorPin()).toBe(true);
    expect(otra.leer()).toBeNull();
  });

  it('desbloquea con el PIN correcto y rechaza el equivocado', async () => {
    await servicio.guardar('token-secreto', '482913');
    const otra = new AlmacenRefrescoService();

    await expectAsync(otra.desbloquear('000000')).toBeResolvedTo(null);
    await expectAsync(otra.desbloquear('482913')).toBeResolvedTo(
      'token-secreto',
    );
    // Tras desbloquear, la sesión puede seguir usándolo.
    expect(otra.leer()).toBe('token-secreto');
  });

  it('vuelve a cifrar el token cuando se configura el PIN (RF03, RNF09)', async () => {
    await servicio.guardar('token-1');
    await servicio.reCifrarConPin('482913');

    const otra = new AlmacenRefrescoService();
    expect(otra.bloqueadoPorPin()).toBe(true);
    await expectAsync(otra.desbloquear('482913')).toBeResolvedTo('token-1');
  });

  it('no rebaja la protección: una sesión con contraseña no sobrescribe el token cifrado', async () => {
    await servicio.guardar('token-cifrado', '482913');

    // Un ingreso con contraseña no conoce el PIN: solo vive en memoria.
    const conPassword = new AlmacenRefrescoService();
    await conPassword.guardar('token-nuevo');

    expect(localStorage.getItem('ica.refresco')).not.toContain('token-nuevo');
    const otra = new AlmacenRefrescoService();
    await expectAsync(otra.desbloquear('482913')).toBeResolvedTo(
      'token-cifrado',
    );
  });

  it('tras desbloquear con el PIN, el token rotado se vuelve a cifrar (RNF09)', async () => {
    await servicio.guardar('token-3', '482913');

    // Una sesión que entró con el PIN conserva la llave en memoria: la
    // rotación del token se guarda cifrada sin volver a pedir el PIN.
    const conPin = new AlmacenRefrescoService();
    await conPin.desbloquear('482913');
    await conPin.guardar('token-4');

    const otra = new AlmacenRefrescoService();
    await expectAsync(otra.desbloquear('482913')).toBeResolvedTo('token-4');
    expect(localStorage.getItem('ica.refresco')).not.toContain('token-4');
  });

  it('borra el token del equipo al cerrar la sesión', async () => {
    await servicio.guardar('token-1');
    servicio.borrar();

    expect(servicio.leer()).toBeNull();
    expect(localStorage.getItem('ica.refresco')).toBeNull();
  });
});
