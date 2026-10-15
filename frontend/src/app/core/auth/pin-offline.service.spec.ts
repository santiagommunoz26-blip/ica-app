import { TestBed } from '@angular/core/testing';
import { MAX_INTENTOS_PIN, PinOfflineService } from './pin-offline.service';

/**
 * Pruebas del PIN sin conexión (RF03). La comprobación del PIN es local: se
 * guarda una derivación PBKDF2, nunca el PIN.
 */
describe('PinOfflineService', () => {
  let servicio: PinOfflineService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(PinOfflineService);
  });

  afterEach(() => localStorage.clear());

  it('no hay PIN configurado al principio', () => {
    expect(servicio.hayPin()).toBe(false);
    expect(servicio.correoDelPin()).toBeNull();
  });

  it('guarda el PIN sin escribirlo en claro', async () => {
    await servicio.guardar('482913', 'ana.ruiz@entidad.gov.co');

    expect(servicio.hayPin()).toBe(true);
    expect(servicio.correoDelPin()).toBe('ana.ruiz@entidad.gov.co');

    const guardado = localStorage.getItem('ica.pin') ?? '';
    expect(guardado).not.toContain('482913');
    expect(guardado).toContain('verificador');
  });

  it('valida el PIN correcto y rechaza el incorrecto', async () => {
    await servicio.guardar('482913', 'ana.ruiz@entidad.gov.co');

    await expectAsync(servicio.verificar('482913')).toBeResolvedTo(true);
    await expectAsync(servicio.verificar('000000')).toBeResolvedTo(false);
  });

  it('bloquea el acceso con PIN tras demasiados intentos fallidos', async () => {
    await servicio.guardar('482913', 'ana.ruiz@entidad.gov.co');

    for (let intento = 0; intento < MAX_INTENTOS_PIN; intento++) {
      await expectAsync(servicio.verificar('111111')).toBeResolvedTo(false);
    }

    expect(servicio.bloqueado()).toBe(true);
    expect(servicio.intentosRestantes()).toBe(0);
    // Incluso con el PIN correcto, queda bloqueado hasta ingresar con la contraseña.
    await expectAsync(servicio.verificar('482913')).toBeResolvedTo(false);
  });

  it('reinicia el contador de intentos cuando el PIN es correcto', async () => {
    await servicio.guardar('482913', 'ana.ruiz@entidad.gov.co');

    await servicio.verificar('111111');
    expect(servicio.intentosRestantes()).toBe(MAX_INTENTOS_PIN - 1);

    await servicio.verificar('482913');
    expect(servicio.intentosRestantes()).toBe(MAX_INTENTOS_PIN);
  });

  it('olvida el PIN cuando se le pide', async () => {
    await servicio.guardar('482913', 'ana.ruiz@entidad.gov.co');
    servicio.olvidar();

    expect(servicio.hayPin()).toBe(false);
    await expectAsync(servicio.verificar('482913')).toBeResolvedTo(false);
  });
});
