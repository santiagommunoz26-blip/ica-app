import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { DatosActaPdf } from './cierre.tipos.js';

/**
 * Renderizado del acta oficial en PDF (M7 · RF41).
 *
 * Genera un A4 en español con los datos del predio, el resultado (calificación
 * final, aportes por grupo y detalle por indicador), los documentos pendientes
 * con su plazo, y la firma del inspector estampada (RF42). El PDF se sube al
 * almacenamiento de objetos y su huella queda en la base (RNF10): este servicio
 * solo dibuja; no habla con el almacenamiento ni con la base.
 *
 * Los colores son los de la paleta de los wireframes (verde esmeralda oscuro,
 * acento lima): el PDF es la cara oficial del aplicativo y sigue la línea
 * gráfica de la interfaz.
 */

/** Paleta del acta (la de los wireframes; no hay tokens compartidos con el SCSS). */
const VERDE_OSCURO = '#10392A';
const LIMA = '#E8F06B';
const GRIS = '#5F6B63';
const LINEA = '#D8D5C7';

const MARGEN = 50;
const ANCHO_UTIL = 595.28 - MARGEN * 2; // A4 en puntos.
const SALTO_PAGINA = 750;

@Injectable()
export class ActaPdfService {
  /** Dibuja el acta y devuelve el PDF completo en memoria (RF41). */
  async generar(datos: DatosActaPdf): Promise<Buffer> {
    const documento = new PDFDocument({
      size: 'A4',
      margin: MARGEN,
      info: {
        Title: `Acta oficial de visita · ${datos.predio.nombre}`,
        Author: 'Aplicativo EBA Aves',
        Subject: datos.definitiva
          ? 'Acta definitiva (RNF10)'
          : 'Acta provisional con documentos pendientes (RF43)',
      },
    });

    const trozos: Buffer[] = [];
    documento.on('data', (trozo: Buffer) => trozos.push(trozo));
    const terminado = new Promise<Buffer>((resolver, rechazar) => {
      documento.on('end', () => resolver(Buffer.concat(trozos)));
      documento.on('error', rechazar);
    });

    this.encabezado(documento, datos);
    this.datosVisita(documento, datos);
    this.resultado(documento, datos);
    this.indicadores(documento, datos);
    this.pendientesYFirma(documento, datos);
    this.pie(documento, datos);

    documento.end();
    return terminado;
  }

  /** Encabezado con el título y el estado del acta (RF41). */
  private encabezado(documento: PDFKit.PDFDocument, datos: DatosActaPdf) {
    documento.rect(0, 0, 595.28, 96).fill(VERDE_OSCURO);

    documento
      .fillColor(LIMA)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('APLICATIVO EBA AVES · METODOLOGÍA ICA', MARGEN, 24);
    documento
      .fillColor('#FFFFFF')
      .fontSize(20)
      .text('Acta oficial de visita', MARGEN, 40);

    const estado = datos.definitiva
      ? 'ACTA DEFINITIVA'
      : 'ACTA PROVISIONAL · DOCUMENTOS PENDIENTES';
    documento
      .fillColor(LIMA)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(estado, 0, 44, { align: 'right', width: 595.28 - MARGEN });
    documento
      .fillColor('#FFFFFF')
      .fontSize(9)
      .font('Helvetica')
      .text(`Versión ${datos.version} · ${fechaHora(datos.emitidaEn)}`, 0, 60, {
        align: 'right',
        width: 595.28 - MARGEN,
      });

    documento.fillColor('#000000');
    documento.y = 120;
  }

  /** Datos del predio y de la visita (RF41). */
  private datosVisita(documento: PDFKit.PDFDocument, datos: DatosActaPdf) {
    this.titulo(documento, 'Datos del predio y de la visita');

    const izquierda: [string, string][] = [
      ['Predio', datos.predio.nombre],
      [
        'Municipio · vereda',
        `${datos.predio.municipio} · ${datos.predio.vereda}`,
      ],
      ['Tipo de predio', datos.predio.etiquetaTipoPredio],
      [
        'Número de aves',
        datos.predio.numeroAves === null
          ? '—'
          : `${datos.predio.numeroAves.toLocaleString('es-CO')} aves`,
      ],
    ];
    const derecha: [string, string][] = [
      ['Responsable', datos.predio.responsable ?? '—'],
      ['Correo del responsable', datos.predio.correoResponsable ?? '—'],
      ['Sistema de producción', datos.predio.etiquetaSistemaProduccion ?? '—'],
      ['Visita programada', fechaHora(datos.visita.programadaPara)],
      ['Grupo productivo', datos.grupoProductivo ?? '—'],
    ];

    this.parDeColumnas(documento, izquierda, derecha);

    const galpones =
      datos.galpones.length === 0
        ? 'Sin galpones registrados.'
        : datos.galpones
            .map(
              (galpon) =>
                `Galpón ${galpon.numero}` +
                (galpon.edadSemanas === null
                  ? ''
                  : ` · ${galpon.edadSemanas} sem`) +
                (galpon.aves === null ? '' : ` · ${galpon.aves} aves`),
            )
            .join('    ');
    this.texto(documento, 'Galpones', galpones);
    documento.moveDown(0.6);
  }

  /** Calificación final y aportes por grupo (RF39). */
  private resultado(documento: PDFKit.PDFDocument, datos: DatosActaPdf) {
    this.titulo(documento, 'Resultado de la evaluación');

    documento.font('Helvetica').fontSize(10).fillColor('#000000');
    const final = datos.final === null ? '—' : `${datos.final.toFixed(2)} %`;
    documento.font('Helvetica-Bold');
    documento.text(
      `Calificación final: ${final}` +
        (datos.clasificacion ? `  ·  Nivel ${datos.clasificacion}` : ''),
    );
    documento.moveDown(0.4);

    // Aporte por grupo: promedio × peso = aporte (RF35).
    documento.fontSize(9);
    for (const grupo of datos.grupos) {
      const promedio =
        grupo.promedio === null ? '—' : `${grupo.promedio.toFixed(2)} %`;
      const aporte = grupo.aporte === null ? '—' : `${grupo.aporte.toFixed(2)}`;
      documento
        .font('Helvetica-Bold')
        .text(grupo.etiqueta, { continued: false })
        .font('Helvetica')
        .fillColor(GRIS)
        .text(`${promedio} × ${grupo.peso} % de peso = aporte ${aporte}`)
        .fillColor('#000000');
      documento.moveDown(0.2);
    }
    documento.moveDown(0.4);
  }

  /** Detalle por indicador evaluado (RF39, RF41). */
  private indicadores(documento: PDFKit.PDFDocument, datos: DatosActaPdf) {
    if (datos.indicadores.length === 0) return;
    this.titulo(documento, 'Indicadores evaluados');

    for (const indicador of datos.indicadores) {
      if (documento.y > SALTO_PAGINA) {
        documento.addPage();
        this.titulo(documento, 'Indicadores evaluados (continuación)');
      }
      const valor =
        indicador.valor === null
          ? '—'
          : `${indicador.valor.toFixed(2)} %${indicador.pendiente ? ' (pendiente)' : ''}`;
      documento
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#000000')
        .text(indicador.codigo, MARGEN, documento.y, { continued: true })
        .font('Helvetica')
        .text(`  ${indicador.nombre}`, { continued: true })
        .fillColor(GRIS)
        .text(`  · ${indicador.grupo}`, { continued: true })
        .fillColor('#000000')
        .text(`  · ${valor}`);
    }
    documento.moveDown(0.6);
  }

  /** Documentos pendientes con su plazo y la firma del inspector (RF43, RF42). */
  private pendientesYFirma(documento: PDFKit.PDFDocument, datos: DatosActaPdf) {
    if (documento.y > 590) documento.addPage();

    if (datos.pendientes.length > 0 && datos.vencimiento) {
      this.titulo(documento, 'Documentos pendientes');
      documento
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#000000')
        .text(
          `El responsable tiene 1 día hábil para entregar lo pendiente: ` +
            `vence el ${fechaHora(datos.vencimiento)}. ` +
            `Si no llega a tiempo, la calificación queda definitiva (RF43, RF44).`,
        );
      documento.moveDown(0.3);
      for (const pendiente of datos.pendientes) {
        documento
          .font('Helvetica-Bold')
          .text(`${pendiente.codigo}`, MARGEN, documento.y, { continued: true })
          .font('Helvetica')
          .text(`  ${pendiente.nombre}`);
      }
      documento.moveDown(0.6);
    }

    // Firma del inspector (RF42).
    if (documento.y > 640) documento.addPage();
    this.titulo(documento, 'Firma del inspector');

    const yFirma = documento.y;
    documento
      .save()
      .rect(MARGEN, yFirma, 220, 80)
      .lineWidth(0.5)
      .strokeColor(LINEA)
      .stroke()
      .restore();
    try {
      documento.image(datos.firma, MARGEN + 10, yFirma + 6, {
        fit: [200, 66],
        align: 'center',
      });
    } catch {
      // Una firma ilegible no puede impedir el acta: queda el pie firmado.
    }

    documento
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#000000')
      .text(datos.inspector, MARGEN, yFirma + 88);
    documento
      .font('Helvetica')
      .fontSize(8)
      .fillColor(GRIS)
      .text(`Firmado el ${fechaHora(datos.firmadaEn)}`, MARGEN, yFirma + 100);
  }

  /** Pie del documento con la identificación del acta (RNF10). */
  private pie(documento: PDFKit.PDFDocument, datos: DatosActaPdf) {
    const y = 812;
    documento
      .font('Helvetica')
      .fontSize(7)
      .fillColor(GRIS)
      .text(
        `Acta ${datos.id} · versión ${datos.version} · ` +
          (datos.definitiva
            ? 'documento definitivo: no se modifica (RNF10).'
            : 'documento provisional: puede reemplazarse si los documentos llegan a tiempo.'),
        MARGEN,
        y,
        { width: ANCHO_UTIL, align: 'center' },
      );
  }

  /** Título de sección con la raya de acento. */
  private titulo(documento: PDFKit.PDFDocument, texto: string) {
    documento
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(VERDE_OSCURO)
      .text(texto);
    documento
      .save()
      .rect(MARGEN, documento.y + 2, 36, 2)
      .fill(LIMA)
      .restore();
    documento.moveDown(0.8);
  }

  /** Dos columnas de etiqueta y valor. */
  private parDeColumnas(
    documento: PDFKit.PDFDocument,
    izquierda: [string, string][],
    derecha: [string, string][],
  ) {
    const yInicial = documento.y;
    const ancho = ANCHO_UTIL / 2 - 10;

    documento.fontSize(9);
    izquierda.forEach(([etiqueta, valor], indice) => {
      const y = yInicial + indice * 26;
      documento
        .font('Helvetica-Bold')
        .fillColor(GRIS)
        .text(etiqueta, MARGEN, y, { width: ancho })
        .font('Helvetica')
        .fillColor('#000000')
        .text(valor, MARGEN, y + 10, { width: ancho });
    });
    derecha.forEach(([etiqueta, valor], indice) => {
      const y = yInicial + indice * 26;
      documento
        .font('Helvetica-Bold')
        .fillColor(GRIS)
        .text(etiqueta, MARGEN + ancho + 20, y, { width: ancho })
        .font('Helvetica')
        .fillColor('#000000')
        .text(valor, MARGEN + ancho + 20, y + 10, { width: ancho });
    });

    documento.y =
      yInicial + Math.max(izquierda.length, derecha.length) * 26 + 4;
  }

  /** Una etiqueta con su valor. */
  private texto(
    documento: PDFKit.PDFDocument,
    etiqueta: string,
    valor: string,
  ) {
    documento
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(GRIS)
      .text(etiqueta, MARGEN, documento.y, { width: ANCHO_UTIL })
      .font('Helvetica')
      .fillColor('#000000')
      .text(valor, MARGEN, documento.y, { width: ANCHO_UTIL });
  }
}

/** Fecha y hora en español de Colombia y en hora de Colombia (RNF03). */
function fechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(fecha);
}
