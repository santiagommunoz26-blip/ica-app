import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource, In } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/configurar-app.js';
import { EstadoUsuario, Rol } from './../src/common/roles.js';
import { hashearSecreto } from './../src/common/password.js';
import { Usuario } from './../src/usuarios/entities/usuario.entity.js';
import { RegistroAcceso } from './../src/usuarios/entities/registro-acceso.entity.js';
import { Predio } from './../src/visitas/entities/predio.entity.js';
import { Visita } from './../src/visitas/entities/visita.entity.js';
import { EstadoVisita, TipoPredio } from './../src/visitas/visitas.tipos.js';

/**
 * Pruebas de integración de la gestión de visitas (M2 · RF08–RF12).
 * Requieren PostgreSQL arriba (make infra).
 */

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

describe('Gestión de visitas (e2e)', () => {
  const PASSWORD = 'Vistas2026*';

  let app: INestApplication<App>;
  let dataSource: DataSource;
  let tokenAdmin: string;
  let tokenInspector: string;
  let tokenConsulta: string;
  let idAdmin: string;
  let idInspector: string;
  let idConsulta: string;
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

  function programarVisita(token: string, datos: Record<string, unknown> = {}) {
    return servidor()
      .post('/api/v1/visitas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        predio: {
          nombre: nombrePredio,
          municipio: 'Sopó',
          vereda: 'Vereda 1',
          tipoPredio: TipoPredio.CORRAL,
        },
        programadaPara: hoyEnBogota(),
        ...datos,
      });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configurarApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    sufijo = String(Date.now());
    nombrePredio = `Granja E2E ${sufijo}`;

    const repositorio = dataSource.getRepository(Usuario);
    const hash = await hashearSecreto(PASSWORD);
    const crear = (nombre: string, rol: Rol) =>
      repositorio.save(
        repositorio.create({
          nombreCompleto: nombre,
          correo: `e2e.m2.${rol.toLowerCase()}.${sufijo}@ica.local`,
          passwordHash: hash,
          rol,
          estado: EstadoUsuario.ACTIVO,
          debeCambiarPassword: false,
        }),
      );

    const admin = await crear('Administradora M2', Rol.ADMINISTRADOR);
    const inspector = await crear('Inspector M2', Rol.INSPECTOR);
    const consulta = await crear('Consulta M2', Rol.CONSULTA);
    idAdmin = admin.id;
    idInspector = inspector.id;
    idConsulta = consulta.id;

    tokenAdmin = await iniciarSesion(admin.correo);
    tokenInspector = await iniciarSesion(inspector.correo);
    tokenConsulta = await iniciarSesion(consulta.correo);
  });

  afterAll(async () => {
    await dataSource
      .getRepository(Visita)
      .delete({ inspectorId: In([idAdmin, idInspector]) });
    await dataSource
      .getRepository(Predio)
      .delete({ nombre: In([nombrePredio, `${nombrePredio} (nuevo)`]) });
    await dataSource
      .getRepository(RegistroAcceso)
      .delete({ usuarioId: In([idAdmin, idInspector, idConsulta]) });
    await dataSource
      .getRepository(Usuario)
      .delete({ id: In([idAdmin, idInspector, idConsulta]) });
    await app.close();
  });

  it('RF08: programa una visita con predio nuevo para el inspector de la sesión', async () => {
    const respuesta = await programarVisita(tokenInspector).expect(201);

    expect(respuesta.body.estado).toBe(EstadoVisita.PROGRAMADA);
    expect(respuesta.body.etiquetaEstado).toBe('Programada');
    expect(respuesta.body.predio.nombre).toBe(nombrePredio);
    expect(respuesta.body.predio.municipio).toBe('Sopó');
    expect(respuesta.body.inspector.id).toBe(idInspector);
    // Sin resultado todavía: lo llena el motor de cálculo (M6).
    expect(respuesta.body.calificacion).toBeNull();
    expect(respuesta.body.accionesPosibles).toEqual([EstadoVisita.EN_CURSO]);
  });

  it('RF08: reutiliza el predio si ya existe con el mismo nombre y municipio', async () => {
    const antes = await dataSource
      .getRepository(Predio)
      .count({ where: { nombre: nombrePredio } });

    await programarVisita(tokenAdmin, {
      programadaPara: hoyEnBogota('10:00:00'),
    }).expect(201);

    const despues = await dataSource
      .getRepository(Predio)
      .count({ where: { nombre: nombrePredio } });
    expect(despues).toBe(antes);
  });

  it('RF11: filtra por estado, municipio y tipo de predio', async () => {
    const listado = await servidor()
      .get('/api/v1/visitas')
      .query({ municipio: 'Sopó', tipoPredio: TipoPredio.CORRAL })
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(listado.body.total).toBeGreaterThanOrEqual(2);
    expect(listado.body.datos[0].predio.municipio).toBe('Sopó');
    expect(listado.body.conteos.todas).toBeGreaterThanOrEqual(2);
    expect(listado.body.conteos.programadas).toBeGreaterThanOrEqual(2);

    const porNombre = await servidor()
      .get('/api/v1/visitas')
      .query({ busqueda: nombrePredio })
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(porNombre.body.total).toBeGreaterThanOrEqual(2);

    const vacio = await servidor()
      .get('/api/v1/visitas')
      .query({ busqueda: nombrePredio, estado: EstadoVisita.CERRADA })
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(vacio.body.total).toBe(0);
  });

  it('RF09: el estado avanza por el ciclo y rechaza los saltos', async () => {
    const creada = await programarVisita(tokenInspector, {
      programadaPara: hoyEnBogota('11:00:00'),
      observaciones: 'Con el productor',
    }).expect(201);
    const id = creada.body.id as string;

    // No se puede cerrar sin haberla abierto.
    await servidor()
      .patch(`/api/v1/visitas/${id}/estado`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ estado: EstadoVisita.CERRADA })
      .expect(409);

    await servidor()
      .patch(`/api/v1/visitas/${id}/estado`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ estado: EstadoVisita.EN_CURSO })
      .expect(200);

    await servidor()
      .patch(`/api/v1/visitas/${id}/estado`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ estado: EstadoVisita.PENDIENTE_DOCUMENTOS })
      .expect(200);

    await servidor()
      .patch(`/api/v1/visitas/${id}/estado`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ estado: EstadoVisita.EN_CURSO })
      .expect(200);

    const cerrada = await servidor()
      .patch(`/api/v1/visitas/${id}/estado`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ estado: EstadoVisita.CERRADA })
      .expect(200);

    expect(cerrada.body.estado).toBe(EstadoVisita.CERRADA);
    expect(cerrada.body.editable).toBe(false);
    expect(cerrada.body.accionesPosibles).toEqual([]);

    // Una visita cerrada no se edita.
    await servidor()
      .patch(`/api/v1/visitas/${id}`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ observaciones: 'Cambio tardío' })
      .expect(409);
  });

  it('RNF07: el Inspector solo ve y toca sus visitas', async () => {
    const propias = await servidor()
      .get('/api/v1/visitas')
      .set('Authorization', `Bearer ${tokenInspector}`)
      .expect(200);

    const ajenas = (
      propias.body.datos as { inspector: { id: string } }[]
    ).filter((visita) => visita.inspector.id !== idInspector);
    expect(ajenas).toHaveLength(0);

    const delAdmin = await servidor()
      .get('/api/v1/visitas')
      .query({ inspectorId: idAdmin })
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(delAdmin.body.total).toBeGreaterThanOrEqual(1);

    const ajena = delAdmin.body.datos[0].id as string;
    await servidor()
      .patch(`/api/v1/visitas/${ajena}/estado`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ estado: EstadoVisita.EN_CURSO })
      .expect(403);
  });

  it('RNF08: el rol Consulta no programa visitas', async () => {
    await programarVisita(tokenConsulta).expect(403);
  });

  it('RNF08: un inspector no puede asignar la visita a otro', async () => {
    await programarVisita(tokenInspector, { inspectorId: idAdmin }).expect(403);
  });

  it('RF10: el resumen del panel devuelve los indicadores', async () => {
    const resumen = await servidor()
      .get('/api/v1/visitas/resumen')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(resumen.body.visitasDelMes).toBeGreaterThanOrEqual(1);
    expect(resumen.body.totalVisitas).toBeGreaterThanOrEqual(1);
    expect(resumen.body.predios).toBeGreaterThanOrEqual(1);
    expect(resumen.body.evolucion).toHaveLength(6);
    expect(resumen.body.distribucion).toHaveLength(4);
    // El promedio por grupo se arma con las visitas que ya tienen resultado
    // (M6): siempre llegan los tres grupos de medidas; sin resultados, en nulo.
    const grupos = resumen.body.promedioPorGrupo as {
      grupo: string;
      etiqueta: string;
      promedio: number | null;
      peso: number | null;
    }[];
    expect(grupos.map((grupo) => grupo.grupo)).toEqual(['MBA', 'MBR', 'MBG']);
    expect(grupos.map((grupo) => grupo.etiqueta)).toEqual([
      'Animal (MBA)',
      'Recursos (MBR)',
      'Gestión (MBG)',
    ]);
    for (const grupo of grupos) {
      expect(
        grupo.promedio === null || typeof grupo.promedio === 'number',
      ).toBe(true);
      expect(grupo.peso === null || typeof grupo.peso === 'number').toBe(true);
    }
    expect(Array.isArray(resumen.body.proximas)).toBe(true);
  });

  it('RF12: sincroniza una visita programada sin conexión y no la duplica', async () => {
    const visitaId = randomUUID();
    const predio = {
      nombre: `${nombrePredio} (nuevo)`,
      municipio: 'Chía',
      vereda: 'Vereda 2',
      tipoPredio: TipoPredio.TRASPATIO,
    };
    const lote = {
      operaciones: [
        {
          id: randomUUID(),
          tipo: 'CREAR_VISITA',
          visitaId,
          crear: {
            id: visitaId,
            predio,
            programadaPara: hoyEnBogota('12:00:00'),
          },
          registradoEn: hoyEnBogota('08:00:00'),
        },
      ],
    };

    const primera = await servidor()
      .post('/api/v1/visitas/sincronizar')
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send(lote)
      .expect(200);
    expect(primera.body.resultados[0].estado).toBe('APLICADA');
    expect(primera.body.visitas[0].id).toBe(visitaId);

    // Reenviar el mismo lote no crea otra visita.
    const repetida = await servidor()
      .post('/api/v1/visitas/sincronizar')
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send(lote)
      .expect(200);
    expect(repetida.body.resultados[0].estado).toBe('APLICADA');

    const enServidor = await dataSource
      .getRepository(Visita)
      .count({ where: { id: visitaId } });
    expect(enServidor).toBe(1);

    // Un cambio sobre una visita cerrada se rechaza y se dice por qué.
    await dataSource
      .getRepository(Visita)
      .update(visitaId, { estado: EstadoVisita.CERRADA });
    const rechazada = await servidor()
      .post('/api/v1/visitas/sincronizar')
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({
        operaciones: [
          {
            id: randomUUID(),
            tipo: 'CAMBIAR_ESTADO',
            visitaId,
            estado: { estado: EstadoVisita.EN_CURSO },
            registradoEn: hoyEnBogota('13:00:00'),
          },
        ],
      })
      .expect(200);
    expect(rechazada.body.resultados[0].estado).toBe('RECHAZADA');
    expect(rechazada.body.resultados[0].motivo).toBeTruthy();
  });

  it('RF11: ofrece los municipios ya usados para el filtro', async () => {
    const municipios = await servidor()
      .get('/api/v1/visitas/municipios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(municipios.body).toContain('Sopó');
  });
});
