import { BadRequestException } from '@nestjs/common';
import { leerFirmaPng } from './actas.service.js';

/** PNG de 1×1 (el más pequeño posible) en base64, como lo manda la pantalla. */
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Firma del acta (M7 · RF42)', () => {
  it('acepta un PNG en base64 y devuelve sus bytes', () => {
    const firma = leerFirmaPng(`data:image/png;base64,${PNG_1X1}`);
    expect(firma.subarray(0, 4).toString('latin1')).toBe('\u0089PNG');
    expect(firma.length).toBeGreaterThan(8);
  });

  it('rechaza lo que no sea PNG', () => {
    expect(() => leerFirmaPng(`data:image/jpeg;base64,${PNG_1X1}`)).toThrow(
      BadRequestException,
    );
  });

  it('rechaza un contenido que no es base64', () => {
    expect(() =>
      leerFirmaPng('data:image/png;base64,¡no es una imagen!'),
    ).toThrow(BadRequestException);
  });

  it('rechaza un PNG demasiado grande', () => {
    // Un PNG de verdad (cabecera válida) pero enorme: se corta por tamaño.
    const enorme = Buffer.concat([
      Buffer.from(PNG_1X1, 'base64'),
      Buffer.alloc(400_000, 0xab),
    ]).toString('base64');
    expect(() => leerFirmaPng(`data:image/png;base64,${enorme}`)).toThrow(
      BadRequestException,
    );
  });

  it('rechaza bytes que dicen ser PNG sin serlo', () => {
    const falso = Buffer.alloc(64, 0xab).toString('base64');
    expect(() => leerFirmaPng(`data:image/png;base64,${falso}`)).toThrow(
      BadRequestException,
    );
  });
});
