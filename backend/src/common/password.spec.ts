import {
  esPinValido,
  generarPasswordTemporal,
  hashearSecreto,
  problemasDePassword,
  verificarSecreto,
} from './password.js';

describe('Cifrado de contraseñas (RF01, RNF07)', () => {
  it('genera un hash argon2id (nunca la contraseña en claro)', async () => {
    const hash = await hashearSecreto('Definitiva2026*');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('Definitiva2026*');
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hashearSecreto('Definitiva2026*');

    await expect(verificarSecreto(hash, 'Definitiva2026*')).resolves.toBe(true);
    await expect(verificarSecreto(hash, 'otra-cosa')).resolves.toBe(false);
  });

  it('devuelve false si el hash guardado no es válido', async () => {
    await expect(verificarSecreto('no-es-un-hash', 'x')).resolves.toBe(false);
  });

  it('genera hashes distintos para la misma contraseña (sal aleatoria)', async () => {
    const primero = await hashearSecreto('Definitiva2026*');
    const segundo = await hashearSecreto('Definitiva2026*');

    expect(primero).not.toBe(segundo);
  });
});

describe('Política de contraseñas (decisión del proyecto)', () => {
  it('exige longitud, minúscula, mayúscula y número', () => {
    expect(problemasDePassword('Definitiva2026*')).toEqual([]);
    expect(problemasDePassword('corta')).toEqual(
      expect.arrayContaining([
        expect.stringContaining('al menos'),
        expect.stringContaining('mayúscula'),
        expect.stringContaining('número'),
      ]),
    );
    expect(problemasDePassword('todoennminusculas123')).toEqual(
      expect.arrayContaining([expect.stringContaining('mayúscula')]),
    );
    expect(problemasDePassword('SinNumerosAqui')).toEqual(
      expect.arrayContaining([expect.stringContaining('número')]),
    );
  });

  it('genera contraseñas temporales que cumplen la política y no se repiten', () => {
    const primera = generarPasswordTemporal();
    const segunda = generarPasswordTemporal();

    expect(problemasDePassword(primera)).toEqual([]);
    expect(problemasDePassword(segunda)).toEqual([]);
    expect(primera).not.toBe(segunda);
    expect(primera.length).toBeGreaterThanOrEqual(10);
  });
});

describe('PIN sin conexión (RF03)', () => {
  it('acepta solo 6 dígitos', () => {
    expect(esPinValido('482913')).toBe(true);
    expect(esPinValido('48291')).toBe(false);
    expect(esPinValido('4829134')).toBe(false);
    expect(esPinValido('48291a')).toBe(false);
    expect(esPinValido('')).toBe(false);
  });
});
