import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Minutos que vive una URL de subida. */
const MINUTOS_SUBIDA = 15;
/** Minutos que vive una URL de consulta. */
const MINUTOS_DESCARGA = 5;

/**
 * Almacenamiento de objetos de las evidencias (RF23, RNFG02, ADR-003).
 *
 * Es el **único** punto del backend que habla con el almacenamiento: en local
 * es MinIO (API S3) y en producción será Cloud Storage, sin tocar el resto del
 * código (portabilidad de RNF26). El binario nunca pasa por la API: el
 * navegador lo sube y lo consulta con **URLs firmadas** de vida corta, y aquí
 * solo se emiten esas URLs, se comprueba que el objeto llegó y se borra.
 */
@Injectable()
export class AlmacenamientoService implements OnModuleInit {
  private readonly logger = new Logger(AlmacenamientoService.name);
  private readonly cliente: S3Client | null;
  private readonly bucket: string;
  private bucketAsegurado: Promise<void> | null = null;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('MINIO_ENDPOINT');
    this.bucket = config.get<string>('MINIO_BUCKET') ?? 'ica-evidencias';

    if (!endpoint) {
      // Sin almacenamiento configurado la aplicación arranca igual; las rutas
      // de evidencias responden 503 con un mensaje claro.
      this.cliente = null;
      return;
    }

    const puerto = config.get<string>('MINIO_PORT') ?? '9000';
    const conSsl = config.get<string>('MINIO_USE_SSL') === 'true';
    this.cliente = new S3Client({
      endpoint: `${conSsl ? 'https' : 'http'}://${endpoint}:${puerto}`,
      region: 'us-east-1',
      // MinIO sirve los objetos por ruta (/bucket/clave), no por subdominio.
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get<string>('MINIO_ROOT_USER') ?? '',
        secretAccessKey: config.get<string>('MINIO_ROOT_PASSWORD') ?? '',
      },
    });
  }

  /** Al arrancar se prepara el bucket, sin impedir el arranque si no está. */
  async onModuleInit(): Promise<void> {
    if (!this.cliente) {
      this.logger.warn(
        'MINIO_ENDPOINT no está configurado: las evidencias quedarán sin almacenamiento.',
      );
      return;
    }
    try {
      await this.asegurarBucket();
    } catch (error) {
      this.logger.warn(
        `No se pudo preparar el bucket de evidencias: ${describir(error)}`,
      );
    }
  }

  /** URL firmada para que el navegador suba el archivo directo al bucket. */
  async urlSubida(ruta: string, tipo: string): Promise<string> {
    return getSignedUrl(
      this.exigirCliente(),
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: ruta,
        ContentType: tipo,
      }),
      { expiresIn: MINUTOS_SUBIDA * 60 },
    );
  }

  /** URL firmada de vida corta para consultar el archivo (RNF22). */
  async urlDescarga(ruta: string, nombre: string): Promise<string> {
    return getSignedUrl(
      this.exigirCliente(),
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: ruta,
        ResponseContentDisposition: `inline; filename="${nombre.replace(/"/g, '')}"`,
      }),
      { expiresIn: MINUTOS_DESCARGA * 60 },
    );
  }

  /** ¿El archivo llegó al almacenamiento? (se usa al confirmar la subida) */
  async existe(ruta: string): Promise<boolean> {
    try {
      await this.exigirCliente().send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: ruta }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Borra el archivo del almacenamiento; si ya no está, no es un error. */
  async borrar(ruta: string): Promise<void> {
    try {
      await this.exigirCliente().send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: ruta }),
      );
    } catch (error) {
      this.logger.warn(`No se pudo borrar ${ruta}: ${describir(error)}`);
    }
  }

  /** Crea el bucket la primera vez que se usa, si hace falta. */
  private asegurarBucket(): Promise<void> {
    this.bucketAsegurado ??= this.crearSiFalta();
    return this.bucketAsegurado;
  }

  private async crearSiFalta(): Promise<void> {
    const cliente = this.exigirCliente();
    try {
      await cliente.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await cliente.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket de evidencias creado: ${this.bucket}`);
    }
  }

  private exigirCliente(): S3Client {
    if (!this.cliente) {
      throw new ServiceUnavailableException(
        'El almacenamiento de evidencias no está configurado (MINIO_ENDPOINT).',
      );
    }
    return this.cliente;
  }
}

function describir(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
