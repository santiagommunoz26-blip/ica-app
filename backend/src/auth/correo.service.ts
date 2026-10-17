import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Datos del correo de recuperación de contraseña (RF06). */
export interface DatosCorreoRecuperacion {
  destinatario: string;
  nombre: string;
  token: string;
}

/** Datos del correo con el acta oficial al responsable del predio (RF45). */
export interface DatosCorreoActa {
  destinatario: string;
  /** Nombre del responsable, para saludarlo en el correo. */
  responsable: string | null;
  /** Nombre del predio. */
  predio: string;
  version: number;
  definitiva: boolean;
  /** Vencimiento del plazo de documentos, si el acta es provisional (RF43). */
  vencimiento: Date | null;
}

/**
 * Envío de correos (RF06).
 *
 * **Estado actual (M1): transporte de consola.** El enlace de recuperación se
 * escribe en el registro del servidor; así el flujo completo se puede probar
 * en desarrollo sin depender de un servidor de correo ni guardar credenciales
 * en el repositorio (RNFG06).
 *
 * Pendiente (requiere que el usuario aporte las credenciales SMTP): añadir un
 * transporte real (SMTP de Google Workspace, SendGrid…). Cambiar
 * CORREO_TRANSPORTE a «smtp» sin implementarlo deja un aviso en el registro.
 */
@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);

  constructor(private readonly config: ConfigService) {}

  private get transporte(): string {
    return this.config.get<string>('CORREO_TRANSPORTE') ?? 'consola';
  }

  private get urlBaseFrontend(): string {
    return (
      this.config.get<string>('URL_BASE_FRONTEND') ?? 'http://localhost:4200'
    );
  }

  /** Envía (o registra, en modo consola) el enlace de recuperación. */
  async enviarRecuperacionPassword(
    datos: DatosCorreoRecuperacion,
  ): Promise<void> {
    const enlace = `${this.urlBaseFrontend}/restablecer-password?token=${encodeURIComponent(
      datos.token,
    )}`;

    if (this.transporte === 'consola') {
      this.logger.log(
        `[CORREO · consola] Recuperación de contraseña para ${datos.destinatario} (${datos.nombre}): ${enlace}`,
      );
      return;
    }

    this.logger.error(
      `Transporte de correo "${this.transporte}" no implementado todavía: el enlace para ${datos.destinatario} no se envió (${enlace}).`,
    );
  }

  /**
   * Envía (o registra, en modo consola) el acta al responsable del predio
   * (RF45).
   *
   * En modo consola queda en el registro del servidor con el resumen del
   * acta; cuando haya credenciales SMTP (pendiente con el usuario) este mismo
   * punto adjuntará el PDF que vive en el almacenamiento. El envío no cambia
   * el acta: solo se anota en ella la fecha y el destinatario.
   */
  async enviarActa(datos: DatosCorreoActa): Promise<void> {
    const saludo = datos.responsable ? `, ${datos.responsable},` : ',';
    const estado = datos.definitiva
      ? 'acta definitiva'
      : `acta provisional (documentos pendientes hasta ${datos.vencimiento?.toISOString() ?? 'el vencimiento'})`;
    const resumen = `${estado} de la visita a ${datos.predio}, versión ${datos.version}`;

    if (this.transporte === 'consola') {
      this.logger.log(
        `[CORREO · consola] Actas para ${datos.destinatario}${saludo} ${resumen}. El PDF adjunto quedará cuando haya un transporte configurado.`,
      );
      return;
    }

    this.logger.error(
      `Transporte de correo "${this.transporte}" no implementado todavía: el ${resumen} para ${datos.destinatario} no se envió.`,
    );
  }
}
