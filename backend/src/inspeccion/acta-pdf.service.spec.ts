import { ActaPdfService } from './acta-pdf.service.js';
import type { DatosActaPdf } from './cierre.tipos.js';

/** PNG de 1×1 para la firma de las pruebas. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Datos completos del acta para las pruebas. */
function datosDePrueba(extra: Partial<DatosActaPdf> = {}): DatosActaPdf {
  return {
    id: 'acta-1',
    version: 1,
    definitiva: true,
    emitidaEn: new Date('2026-10-16T15:00:00Z'),
    predio: {
      nombre: 'Granja El Cortijo',
      municipio: 'Rionegro',
      vereda: 'La Convención',
      etiquetaTipoPredio: 'Corral',
      responsable: 'Carlos Rojas',
      correoResponsable: 'carlos.rojas@correo.com',
      numeroAves: 62000,
      etiquetaSistemaProduccion: 'Ponedoras en jaula',
    },
    visita: { programadaPara: new Date('2026-10-16T13:00:00Z') },
    inspector: 'Ana Cruz',
    grupoProductivo: 'Ponedora en jaula',
    galpones: [{ numero: 1, aves: 30000, edadSemanas: 60 }],
    grupos: [
      { etiqueta: 'Animal', peso: 35, promedio: 78, aporte: 27.3 },
      { etiqueta: 'Recursos', peso: 35, promedio: 85, aporte: 29.75 },
      { etiqueta: 'Gestión', peso: 30, promedio: 83, aporte: 24.9 },
    ],
    final: 81.95,
    clasificacion: 'Alto',
    indicadores: [
      {
        codigo: 'MBA-01',
        nombre: 'Podo dermatitis',
        grupo: 'Animal',
        valor: 58,
        pendiente: false,
      },
    ],
    pendientes: [],
    vencimiento: null,
    firma: PNG_1X1,
    firmadaEn: new Date('2026-10-16T15:00:00Z'),
    ...extra,
  };
}

describe('Acta en PDF (M7 · RF41)', () => {
  const servicio = new ActaPdfService();

  it('genera un PDF con los datos del acta definitiva', async () => {
    const pdf = await servicio.generar(datosDePrueba());
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('genera el acta provisional con pendientes y vencimiento', async () => {
    const pdf = await servicio.generar(
      datosDePrueba({
        definitiva: false,
        pendientes: [
          {
            codigo: 'MBG-09',
            nombre: 'Mortalidad',
            grupo: 'Gestión',
            valor: 0,
            pendiente: true,
          },
        ],
        vencimiento: new Date('2026-10-19T22:00:00Z'),
        indicadores: [
          {
            codigo: 'MBG-09',
            nombre: 'Mortalidad',
            grupo: 'Gestión',
            valor: 0,
            pendiente: true,
          },
        ],
      }),
    );
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('no falla con muchas filas: salta de página', async () => {
    const indicadores = Array.from({ length: 120 }, (_, indice) => ({
      codigo: `MBR-${String(indice + 1).padStart(2, '0')}`,
      nombre: `Indicador de prueba ${indice + 1}`,
      grupo: 'Recursos',
      valor: 75,
      pendiente: false,
    }));
    const pdf = await servicio.generar(datosDePrueba({ indicadores }));
    const paginas = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g);
    expect(pdf.length).toBeGreaterThan(5_000);
    expect(paginas?.length ?? 0).toBeGreaterThan(1);
  });
});
