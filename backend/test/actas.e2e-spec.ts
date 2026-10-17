import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/configurar-app.js';
import { EstadoUsuario, Rol } from './../src/common/roles.js';
import { hashearSecreto } from './../src/common/password.js';
import { Usuario } from './../src/usuarios/entities/usuario.entity.js';
import { RegistroAcceso } from './../src/usuarios/entities/registro-acceso.entity.js';
import { EventoBitacora } from './../src/usuarios/entities/registro-acceso.entity.js';
import { GrupoProductivo } from './../src/metodologia/metodologia.tipos.js';
import { TipoPredio } from './../src/visitas/visitas.tipos.js';
import { Acta } from './../src/inspeccion/entities/acta.entity.js';
import { AlmacenamientoService } from './../src/inspeccion/almacenamiento.service.js';

/**
 * Pruebas de integración del cierre y las actas (M7 · RF39–RF45). Requieren
 * PostgreSQL arriba (make infra o make dev-infra).
 */

/**
 * Almacenamiento de mentira: recuerda lo que el backend sube (el PDF del acta
 * y la firma) para no depender de MinIO.
 */
class AlmacenamientoFalso {
  readonly subidos = new Map<string, Buffer>();

  async urlSubida(ruta: string): Promise<string> {
    return `https://almacenamiento.local/${ruta}?firma=subida`;
  }

  async urlDescarga(ruta: string): Promise<string> {
    return `https://almacenamiento.local/${ruta}?firma=descarga`;
  }

  async existe(ruta: string): Promise<boolean> {
    return this.subidos.has(ruta);
  }

  async borrar(ruta: string): Promise<void> {
    this.subidos.delete(ruta);
  }

  async subir(ruta: string, contenido: Buffer): Promise<void> {
    this.subidos.set(ruta, contenido);
  }
}

/** Almacenamiento compartido por todas las pruebas del archivo. */
const almacenamiento = new AlmacenamientoFalso();

/** PNG de 1×1 en base64, como lo manda la pantalla de firma (RF42). */
const FIRMA_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Fecha de hoy a las 09:00 en la hora de Colombia (sin horario de verano). */
function hoyEnBogota(hora = '09:00:00'): string {
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return `${fecha}T${hora}-05:00`;
}

/** Lo que la interfaz lee del cierre (M7). */
interface Fase4Respuesta {
  completo: boolean;
  indicadoresSinEvaluar: number;
  indicadores: {
    codigo: string;
    nombre: string;
    grupo: string;
    etiquetaGrupo: string;
    valor: number | null;
    pendiente: boolean;
    prioridad: string | null;
    etiquetaPrioridad: string | null;
  }[];
  final: number | null;
  clasificacion: string | null;
  etiquetaClasificacion: string | null;
  grupos: {
    grupo: string;
    etiqueta: string;
    peso: number;
    promedio: number | null;
    aporte: number | null;
  }[];
  documentosPendientes: number;
  vencimiento: string | null;
  vencido: boolean;
  acta: {
    id: string;
    version: number;
    definitiva: boolean;
    firmadaEn: string;
    firmadaPorNombre: string;
    documentosPendientes: number;
    vencimientoDocumentos: string | null;
    calificacion: number | null;
    clasificacion: string | null;
    etiquetaClasificacion: string | null;
    correoEnviadoEn: string | null;
    correoDestinatario: string | null;
    tamano: number;
    huella: string;
  } | null;
  puedeEmitir: boolean;
  motivoNoEmitir: string | null;
}

describe('Cierre y actas (e2e)', () => {
  const PASSWORD = 'Cierre2026*';

  let app: INestApplication<App>;
  let dataSource: DataSource;
  let tokenInspector: string;
  let tokenOtroInspector: string;
  let tokenConsulta: string;
  let idInspector: string;
  let sufijo: string;
  let nombrePredio: string;

  const servidor = () => request(app.getHttpServer());

  async function iniciarSesion(correo: string): Promise<string> {
    const respuesta = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo, password: PASSWORD })
      .expect(200);
    return respuesta.body.accessToken as string;
  }

  /** Programa una visita para el inspector de la sesión y devuelve su id. */
  async function programarVisita(
    token: string,
    nombre = nombrePredio,
  ): Promise<string> {
    const respuesta = await servidor()
      .post('/api/v1/visitas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        predio: {
          nombre,
          municipio: 'Sopó',
          vereda: 'Vereda 1',
          tipoPredio: TipoPredio.CORRAL,
        },
        programadaPara: hoyEnBogota(),
      })
      .expect(201);
    return respuesta.body.id as string;
  }

  const guardar = (token: string, visitaId: string, cuerpo: unknown) =>
    servidor()
      .put(`/api/v1/inspeccion/${visitaId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo as object);

  const obtener = (token: string, visitaId: string) =>
    servidor()
      .get(`/api/v1/inspeccion/${visitaId}`)
      .set('Authorization', `Bearer ${token}`);

  const firmar = (token: string, visitaId: string, firma = FIRMA_PNG) =>
    servidor()
      .post(`/api/v1/inspeccion/${visitaId}/acta`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firma });

  /**
   * Deja la visita lista para el cierre: ficha, ambas fases completas y, si
   * se pide, un documento pendiente y el correo del responsable.
   *
   * Con todo en 2 puntos (o 94,44 % en los galpones) el resultado sin
   * pendientes es 96,11 (RF36); con un documento pendiente en 0, la acta
   * provisional baja a 93,11 (RF43).
   */
  async function completar(
    token: string,
    visitaId: string,
    opciones: { pendiente?: string; correoResponsable?: string } = {},
  ) {
    const ficha = await obtener(token, visitaId).expect(200);
    const indicadores = ficha.body.catalogo.indicadores as {
      codigo: string;
      grupo: string;
      gruposProductivos: string[];
    }[];
    const aplicables = indicadores.filter(
      (fila) =>
        fila.grupo !== 'MBG' &&
        fila.gruposProductivos.includes(GrupoProductivo.POLLO_ENGORDE),
    );
    // Ocho puntos en 2 y el último en 1 → 94,44 % (RF34).
    const puntos = [2, 2, 2, 2, 2, 2, 2, 2, 1].map((puntaje, indice) => ({
      numero: indice + 1,
      puntaje,
      aves: 20,
    }));
    const evaluaciones = [1, 2].flatMap((galponNumero) =>
      aplicables.map((fila) => ({
        galponNumero,
        indicadorCodigo: fila.codigo,
        puntos,
      })),
    );
    const documentos = indicadores
      .filter((fila) => fila.grupo === 'MBG')
      .map((fila) =>
        fila.codigo === opciones.pendiente
          ? { indicadorCodigo: fila.codigo, pendiente: true }
          : {
              indicadorCodigo: fila.codigo,
              presentado: true,
              legible: true,
              firmadoResponsable: true,
              puntaje: 2,
            },
      );

    await guardar(token, visitaId, {
      numeroAves: 62000,
      grupoProductivo: GrupoProductivo.POLLO_ENGORDE,
      galpones: [
        { numero: 1, edadSemanas: 62, seleccionado: true },
        { numero: 2, edadSemanas: 40, seleccionado: true },
      ],
      ...(opciones.correoResponsable
        ? { correoResponsable: opciones.correoResponsable }
        : {}),
      evaluaciones,
      documentos,
    }).expect(200);

    return obtener(token, visitaId).expect(200);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AlmacenamientoService)
      .useValue(almacenamiento)
      .compile();

    app = moduleFixture.createNestApplication();
    configurarApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    sufijo = String(Date.now());
    nombrePredio = `Granja Cierre E2E ${sufijo}`;

    const repositorio = dataSource.getRepository(Usuario);
    const hash = await hashearSecreto(PASSWORD);
    const crear = (nombre: string, rol: Rol) =>
      repositorio.save(
        repositorio.create({
          nombreCompleto: nombre,
          correo: `e2e.m7.${rol.toLowerCase()}.${randomUUID().slice(0, 8)}@ica.local`,
          passwordHash: hash,
          rol,
          estado: EstadoUsuario.ACTIVO,
          debeCambiarPassword: false,
        }),
      );

    const inspector = await crear('Inspectora M7', Rol.INSPECTOR);
    const otro = await crear('Inspector Dos M7', Rol.INSPECTOR);
    const consulta = await crear('Consulta M7', Rol.CONSULTA);
    idInspector = inspector.id;

    tokenInspector = await iniciarSesion(inspector.correo);
    tokenOtroInspector = await iniciarSesion(otro.correo);
    tokenConsulta = await iniciarSesion(consulta.correo);
  });

  afterAll(async () => {
    await app.close();
  });

  it('RF39–RF40: la pantalla de cierre llega lista para firmar', async () => {
    const visitaId = await programarVisita(tokenInspector);
    const respuesta = await completar(tokenInspector, visitaId);
    const fase4 = respuesta.body.fase4 as Fase4Respuesta;

    expect(fase4.completo).toBe(true);
    expect(fase4.final).toBe(96.11);
    expect(fase4.etiquetaClasificacion).toBe('Excelente');
    expect(fase4.documentosPendientes).toBe(0);
    expect(fase4.vencimiento).toBeNull();
    expect(fase4.acta).toBeNull();
    expect(fase4.puedeEmitir).toBe(true);
    expect(fase4.motivoNoEmitir).toBeNull();

    // Los aportes por grupo del cierre (RF39).
    const mba = fase4.grupos.find((grupo) => grupo.grupo === 'MBA');
    expect(mba?.promedio).toBe(94.44);
    expect(mba?.peso).toBe(35);

    // Los indicadores a mejorar llegan clasificados por prioridad (RF40).
    expect(fase4.indicadores.length).toBeGreaterThan(0);
    const prioridades = fase4.indicadores.map((fila) => fila.prioridad);
    const orden = ['ALTA', 'MEDIA', 'SIN_PRIORIDAD'];
    const indices = prioridades.map((prioridad) =>
      orden.indexOf(prioridad ?? ''),
    );
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(fase4.indicadores[0].nombre).toBeTruthy();
    expect(fase4.indicadores[0].etiquetaGrupo).toBeTruthy();
  });

  it('RF41–RF42: firma el acta, cierra la visita y guarda el PDF', async () => {
    const visitaId = await programarVisita(tokenInspector);
    await completar(tokenInspector, visitaId, {
      correoResponsable: 'responsable@ica.local',
    });

    almacenamiento.subidos.clear();
    const respuesta = await firmar(tokenInspector, visitaId).expect(201);
    const fase4 = respuesta.body as Fase4Respuesta;

    expect(fase4.acta?.version).toBe(1);
    expect(fase4.acta?.definitiva).toBe(true);
    expect(fase4.acta?.calificacion).toBe(96.11);
    expect(fase4.acta?.etiquetaClasificacion).toBe('Excelente');
    expect(fase4.puedeEmitir).toBe(false);

    // La visita quedó cerrada.
    const despues = await obtener(tokenInspector, visitaId).expect(200);
    expect(despues.body.visita.estado).toBe('CERRADA');
    expect(despues.body.calculo.final).toBe(96.11);

    // El PDF y la firma llegaron al almacenamiento (RF41, RF42).
    const pdf = almacenamiento.subidos.get(`actas/${visitaId}/acta-v1.pdf`);
    const firma = almacenamiento.subidos.get(`actas/${visitaId}/firma-v1.png`);
    expect(pdf).toBeDefined();
    expect(firma).toBeDefined();
    expect(pdf?.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(fase4.acta?.tamano).toBe(pdf?.length);
    expect(fase4.acta?.huella).toMatch(/^[0-9a-f]{64}$/);

    // La descarga entrega una URL firmada del objeto (RNF22).
    const descarga = await servidor()
      .get(`/api/v1/inspeccion/${visitaId}/acta/descarga`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .expect(200);
    expect(String(descarga.body.url)).toContain(
      `actas/${visitaId}/acta-v1.pdf`,
    );

    // Queda el rastro en la bitácora (RNF11).
    const evento = await dataSource.getRepository(RegistroAcceso).findOne({
      where: { evento: EventoBitacora.ACTA_EMITIDA, usuarioId: idInspector },
      order: { createdAt: 'DESC' },
    });
    expect(evento?.detalle).toContain(visitaId);

    // Una acta definitiva no se vuelve a firmar (RNF10).
    const otra = await firmar(tokenInspector, visitaId).expect(409);
    expect(String(otra.body.message)).toContain('cerrada');
  });

  it('RF43: con documentos pendientes abre el plazo y firma el acta provisional', async () => {
    const visitaId = await programarVisita(tokenInspector);
    const preparada = await completar(tokenInspector, visitaId, {
      pendiente: 'MBG-09',
    });
    const previa = preparada.body.fase4 as Fase4Respuesta;

    // El pendiente cuenta como 0 provisionalmente: la calificación baja y la
    // fila del indicador avisa que está pendiente (RF40, RF43).
    expect(previa.completo).toBe(true);
    expect(previa.final).toBe(93.11);
    expect(previa.documentosPendientes).toBe(1);
    expect(previa.puedeEmitir).toBe(true);
    const mortalidad = previa.indicadores.find(
      (fila) => fila.codigo === 'MBG-09',
    );
    expect(mortalidad?.pendiente).toBe(true);
    expect(mortalidad?.prioridad).toBe('ALTA');

    const respuesta = await firmar(tokenInspector, visitaId).expect(201);
    const fase4 = respuesta.body as Fase4Respuesta;
    expect(fase4.acta?.version).toBe(1);
    expect(fase4.acta?.definitiva).toBe(false);
    expect(fase4.acta?.documentosPendientes).toBe(1);
    expect(fase4.acta?.calificacion).toBe(93.11);

    // El plazo vence a las 5:00 p. m. de Colombia, en día hábil (RF43).
    expect(fase4.vencimiento).toBeTruthy();
    const vencimiento = new Date(fase4.vencimiento ?? '');
    expect(vencimiento.getTime()).toBeGreaterThan(Date.now());
    const enBogota = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(vencimiento);
    expect(enBogota).toContain('17:00');
    expect(enBogota).not.toMatch(/Sat|Sun/);

    // La visita queda pendiente de documentos.
    const despues = await obtener(tokenInspector, visitaId).expect(200);
    expect(despues.body.visita.estado).toBe('PENDIENTE_DOCUMENTOS');

    // Mientras haya pendientes no se re-firma: hay que esperar el recálculo
    // (RF44).
    const otra = await firmar(tokenInspector, visitaId).expect(409);
    expect(String(otra.body.message)).toContain('pendientes');
  });

  it('RF44: si los documentos llegan a tiempo, recalcula y emite la definitiva', async () => {
    const visitaId = await programarVisita(tokenInspector);
    await completar(tokenInspector, visitaId, { pendiente: 'MBG-09' });
    await firmar(tokenInspector, visitaId).expect(201);

    // Llega la mortalidad dentro del plazo: 4 % son 2 puntos en engorde.
    await guardar(tokenInspector, visitaId, {
      documentos: [
        { indicadorCodigo: 'MBG-09', presentado: true, mortalidad: 4 },
      ],
    }).expect(200);

    const recalculada = await obtener(tokenInspector, visitaId).expect(200);
    const fase4 = recalculada.body.fase4 as Fase4Respuesta;
    expect(fase4.final).toBe(96.11);
    expect(fase4.documentosPendientes).toBe(0);
    expect(fase4.puedeEmitir).toBe(true);
    expect(fase4.acta?.version).toBe(1);

    // La nueva acta es la definitiva y cierra la visita (RF44).
    const respuesta = await firmar(tokenInspector, visitaId).expect(201);
    const definitiva = respuesta.body as Fase4Respuesta;
    expect(definitiva.acta?.version).toBe(2);
    expect(definitiva.acta?.definitiva).toBe(true);
    expect(definitiva.acta?.calificacion).toBe(96.11);
    expect(definitiva.vencimiento).toBeNull();

    const despues = await obtener(tokenInspector, visitaId).expect(200);
    expect(despues.body.visita.estado).toBe('CERRADA');

    // Las dos versiones quedan en el almacenamiento; la descarga da la vigente.
    expect(almacenamiento.subidos.has(`actas/${visitaId}/acta-v1.pdf`)).toBe(
      true,
    );
    expect(almacenamiento.subidos.has(`actas/${visitaId}/acta-v2.pdf`)).toBe(
      true,
    );
    const descarga = await servidor()
      .get(`/api/v1/inspeccion/${visitaId}/acta/descarga`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .expect(200);
    expect(String(descarga.body.url)).toContain('acta-v2.pdf');
  });

  it('RF44/RNF10: si vence el plazo, la calificación queda definitiva', async () => {
    const visitaId = await programarVisita(tokenInspector);
    await completar(tokenInspector, visitaId, { pendiente: 'MBG-09' });
    await firmar(tokenInspector, visitaId).expect(201);

    // Se simula que pasó el plazo moviendo el vencimiento de la acta.
    await dataSource
      .getRepository(Acta)
      .createQueryBuilder()
      .update(Acta)
      .set({ vencimientoDocumentos: new Date(Date.now() - 60 * 60 * 1000) })
      .where('visita_id = :visitaId', { visitaId })
      .execute();

    // Al consultar, el vencimiento se materializa (RF44): la acta pasa a
    // definitiva, la calificación queda como estaba y la visita se cierra.
    const respuesta = await obtener(tokenInspector, visitaId).expect(200);
    const fase4 = respuesta.body.fase4 as Fase4Respuesta;
    expect(fase4.vencido).toBe(true);
    expect(fase4.acta?.definitiva).toBe(true);
    expect(fase4.acta?.version).toBe(1);
    expect(fase4.acta?.calificacion).toBe(93.11);
    expect(respuesta.body.visita.estado).toBe('CERRADA');

    // Ya no se firma otra acta ni se edita la visita (RNF10).
    const firma = await firmar(tokenInspector, visitaId).expect(409);
    expect(String(firma.body.message)).toContain('cerrada');
    const edicion = await guardar(tokenInspector, visitaId, {
      observaciones: 'tarde',
    }).expect(409);
    expect(String(edicion.body.message)).toContain('cerrada');
  });

  it('RF45: envía el acta por correo al responsable', async () => {
    const visitaId = await programarVisita(tokenInspector);
    await completar(tokenInspector, visitaId, {
      correoResponsable: 'responsable@ica.local',
    });
    await firmar(tokenInspector, visitaId).expect(201);

    const envio = await servidor()
      .post(`/api/v1/inspeccion/${visitaId}/acta/correo`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({})
      .expect(200);
    expect(envio.body.destinatario).toBe('responsable@ica.local');

    // El envío queda anotado en el acta y en la bitácora (RF45, RNF11).
    const despues = await obtener(tokenInspector, visitaId).expect(200);
    const acta = (despues.body.fase4 as Fase4Respuesta).acta;
    expect(acta?.correoDestinatario).toBe('responsable@ica.local');
    expect(acta?.correoEnviadoEn).toBeTruthy();

    // Se puede indicar otro destinatario puntual.
    const otro = await servidor()
      .post(`/api/v1/inspeccion/${visitaId}/acta/correo`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ destinatario: 'amigo@ica.local' })
      .expect(200);
    expect(otro.body.destinatario).toBe('amigo@ica.local');

    // Sin correo registrado y sin destinatario, se explica qué falta.
    const sinCorreoId = await programarVisita(
      tokenInspector,
      `${nombrePredio} sin correo`,
    );
    await completar(tokenInspector, sinCorreoId);
    await firmar(tokenInspector, sinCorreoId).expect(201);
    const sinCorreo = await servidor()
      .post(`/api/v1/inspeccion/${sinCorreoId}/acta/correo`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({})
      .expect(400);
    expect(String(sinCorreo.body.message)).toContain('correo del responsable');
  });

  it('RNF07/RNF08: solo el inspector de la visita firma y envía', async () => {
    const visitaId = await programarVisita(tokenInspector);
    await completar(tokenInspector, visitaId);

    // Otro inspector no puede firmar una visita ajena.
    const ajeno = await firmar(tokenOtroInspector, visitaId).expect(403);
    expect(String(ajeno.body.message)).toContain('no está a su cargo');

    // El rol Consulta solo consulta: ni firma ni envía.
    await firmar(tokenConsulta, visitaId).expect(403);
    await servidor()
      .post(`/api/v1/inspeccion/${visitaId}/acta/correo`)
      .set('Authorization', `Bearer ${tokenConsulta}`)
      .send({})
      .expect(403);

    // La consulta sí puede leer el acta una vez firmada (RF04).
    await firmar(tokenInspector, visitaId).expect(201);
    await servidor()
      .get(`/api/v1/inspeccion/${visitaId}/acta/descarga`)
      .set('Authorization', `Bearer ${tokenConsulta}`)
      .expect(200);
  });

  it('RF41–RF42: no se firma sin el cálculo completo y la firma debe ser PNG', async () => {
    const visitaId = await programarVisita(tokenInspector);

    // Sin inspección no hay nada que cerrar.
    const sinInspeccion = await firmar(tokenInspector, visitaId).expect(409);
    expect(String(sinInspeccion.body.message)).toContain('no ha comenzado');

    // Con la ficha a medias, faltan indicadores y el cierre lo dice.
    await guardar(tokenInspector, visitaId, {
      numeroAves: 62000,
      grupoProductivo: GrupoProductivo.POLLO_ENGORDE,
      galpones: [{ numero: 1, edadSemanas: 62, seleccionado: true }],
    }).expect(200);
    const incompleta = await firmar(tokenInspector, visitaId).expect(409);
    expect(String(incompleta.body.message)).toContain('faltan indicadores');

    // El detalle del cierre explica por qué no se puede emitir todavía.
    const fase4 = (await obtener(tokenInspector, visitaId).expect(200)).body
      .fase4 as Fase4Respuesta;
    expect(fase4.puedeEmitir).toBe(false);
    expect(fase4.indicadoresSinEvaluar).toBeGreaterThan(0);
    expect(fase4.motivoNoEmitir).toContain('faltan indicadores');

    // Una firma que no es PNG se rechaza con un mensaje claro (RF42).
    await completar(tokenInspector, visitaId);
    const firmaMala = await firmar(
      tokenInspector,
      visitaId,
      `data:image/jpeg;base64,${'A'.repeat(64)}`,
    ).expect(400);
    expect(String(firmaMala.body.message)).toContain('PNG');
  });
});
