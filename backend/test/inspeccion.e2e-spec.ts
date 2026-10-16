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
import { Indicador } from './../src/metodologia/entities/indicador.entity.js';
import { Metodologia } from './../src/metodologia/entities/metodologia.entity.js';
import {
  GrupoProductivo,
  SistemaProduccion,
} from './../src/metodologia/metodologia.tipos.js';
import { Predio } from './../src/visitas/entities/predio.entity.js';
import { Visita } from './../src/visitas/entities/visita.entity.js';
import { EstadoVisita, TipoPredio } from './../src/visitas/visitas.tipos.js';
import { AlmacenamientoService } from './../src/inspeccion/almacenamiento.service.js';

/**
 * Pruebas de integración de la apertura y la ficha general (M3 · RF13–RF17) y
 * de la inspección en galpón (M4 · RF18–RF26). Requieren PostgreSQL arriba
 * (make infra).
 */

/**
 * Almacenamiento de mentira para las pruebas: recuerda qué rutas se firmaron
 * (como si el navegador hubiera subido el archivo) sin depender de MinIO.
 */
class AlmacenamientoFalso {
  readonly objetos = new Set<string>();
  simularSubida = true;

  async urlSubida(ruta: string): Promise<string> {
    if (this.simularSubida) this.objetos.add(ruta);
    return `https://almacenamiento.local/${ruta}?firma=subida`;
  }

  async urlDescarga(ruta: string): Promise<string> {
    return `https://almacenamiento.local/${ruta}?firma=descarga`;
  }

  async existe(ruta: string): Promise<boolean> {
    return this.objetos.has(ruta);
  }

  async borrar(ruta: string): Promise<void> {
    this.objetos.delete(ruta);
  }
}

/** Almacenamiento compartido por todas las pruebas del archivo. */
const almacenamiento = new AlmacenamientoFalso();

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

describe('Apertura e inspección (e2e)', () => {
  const PASSWORD = 'Inspeccion2026*';

  let app: INestApplication<App>;
  let dataSource: DataSource;
  let tokenInspector: string;
  let tokenOtroInspector: string;
  let tokenConsulta: string;
  let idAdmin: string;
  let idInspector: string;
  let idOtroInspector: string;
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

  /** Programa una visita para el inspector de la sesión y devuelve su id. */
  async function programarVisita(
    token: string,
    programadaPara = hoyEnBogota(),
  ): Promise<string> {
    const respuesta = await servidor()
      .post('/api/v1/visitas')
      .set('Authorization', `Bearer ${token}`)
      .send({
        predio: {
          nombre: nombrePredio,
          municipio: 'Sopó',
          vereda: 'Vereda 1',
          tipoPredio: TipoPredio.CORRAL,
        },
        programadaPara,
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
    nombrePredio = `Granja Inspección E2E ${sufijo}`;

    const repositorio = dataSource.getRepository(Usuario);
    const hash = await hashearSecreto(PASSWORD);
    const crear = (nombre: string, rol: Rol) =>
      repositorio.save(
        repositorio.create({
          nombreCompleto: nombre,
          correo: `e2e.m3.${rol.toLowerCase()}.${randomUUID().slice(0, 8)}@ica.local`,
          passwordHash: hash,
          rol,
          estado: EstadoUsuario.ACTIVO,
          debeCambiarPassword: false,
        }),
      );

    const admin = await crear('Administradora M3', Rol.ADMINISTRADOR);
    const inspector = await crear('Inspector M3', Rol.INSPECTOR);
    const otro = await crear('Inspector Dos M3', Rol.INSPECTOR);
    const consulta = await crear('Consulta M3', Rol.CONSULTA);
    idAdmin = admin.id;
    idInspector = inspector.id;
    idOtroInspector = otro.id;
    idConsulta = consulta.id;

    tokenInspector = await iniciarSesion(inspector.correo);
    tokenOtroInspector = await iniciarSesion(otro.correo);
    tokenConsulta = await iniciarSesion(consulta.correo);
  });

  afterAll(async () => {
    await dataSource
      .getRepository(Visita)
      .delete({ inspectorId: In([idAdmin, idInspector, idOtroInspector]) });
    await dataSource.getRepository(Predio).delete({ nombre: nombrePredio });
    await dataSource.getRepository(RegistroAcceso).delete({
      usuarioId: In([idAdmin, idInspector, idOtroInspector, idConsulta]),
    });
    await dataSource
      .getRepository(Usuario)
      .delete({ id: In([idAdmin, idInspector, idOtroInspector, idConsulta]) });
    await app.close();
  });

  it('el catálogo sembrado tiene las versiones, los pesos y los indicadores (RF14, RF17)', async () => {
    const metodologia = await dataSource
      .getRepository(Metodologia)
      .findOne({ where: { activa: true } });
    expect(metodologia).not.toBeNull();
    // Mientras no esté el manual, el catálogo está marcado como provisional.
    expect(metodologia?.provisional).toBe(true);

    const indicadores = await dataSource
      .getRepository(Indicador)
      .find({ where: { metodologiaId: metodologia?.id } });
    expect(indicadores.length).toBeGreaterThanOrEqual(29);
    expect(new Set(indicadores.map((indicador) => indicador.grupo))).toEqual(
      new Set(['MBA', 'MBR', 'MBG']),
    );
  });

  it('RF13: la inspección arranca sin ficha y con el catálogo', async () => {
    const visitaId = await programarVisita(tokenInspector);
    const respuesta = await obtener(tokenInspector, visitaId).expect(200);

    expect(respuesta.body.ficha.guardada).toBe(false);
    expect(respuesta.body.galpones).toEqual([]);
    expect(respuesta.body.catalogo.provisional).toBe(true);
    expect(respuesta.body.catalogo.gruposProductivos.length).toBe(3);
    expect(respuesta.body.catalogo.sistemasProduccion.length).toBeGreaterThan(
      0,
    );
    // Sin número de aves todavía se muestra el tipo declarado al programar.
    expect(respuesta.body.ficha.tipoPredio).toBe(TipoPredio.CORRAL);
  });

  it('RF14: clasifica como corral desde 200 aves y aplica los pesos de corral', async () => {
    const visitaId = await programarVisita(tokenInspector);
    const respuesta = await guardar(tokenInspector, visitaId, {
      responsable: 'Carlos Rojas',
      numeroAves: 62000,
      sistemaProduccion: SistemaProduccion.ABIERTO_MECANIZADO,
      grupoProductivo: GrupoProductivo.PONEDORA_JAULA,
      galpones: [
        { numero: 1, edadSemanas: 62, seleccionado: true },
        { numero: 2, edadSemanas: 40 },
        { numero: 3, edadSemanas: 18 },
      ],
    }).expect(200);

    expect(respuesta.body.predio.tipoPredio).toBe(TipoPredio.CORRAL);
    expect(respuesta.body.predio.etiquetaTipoPredio).toBe('Granja (corral)');
    expect(respuesta.body.ficha.guardada).toBe(true);
    expect(respuesta.body.ficha.grupoProductivo).toBe(
      GrupoProductivo.PONEDORA_JAULA,
    );
    // Pesos de corral: 35 / 35 / 30.
    expect(
      respuesta.body.ficha.pesos.map(
        (peso: { grupo: string; peso: number }) => [peso.grupo, peso.peso],
      ),
    ).toEqual([
      ['MBA', 35],
      ['MBR', 35],
      ['MBG', 30],
    ]);
    // RF16: con 62.000 aves se sugieren dos galpones, los de mayor edad.
    expect(respuesta.body.ficha.galponesSugeridos).toBe(2);
    const sugeridos = respuesta.body.galpones
      .filter((galpon: { sugerido: boolean }) => galpon.sugerido)
      .map((galpon: { numero: number }) => galpon.numero);
    expect(sugeridos).toEqual([1, 2]);
  });

  it('RF14: clasifica como traspatio con 199 aves o menos', async () => {
    const visitaId = await programarVisita(tokenInspector);
    const respuesta = await guardar(tokenInspector, visitaId, {
      numeroAves: 150,
    }).expect(200);

    expect(respuesta.body.predio.tipoPredio).toBe(TipoPredio.TRASPATIO);
    expect(
      respuesta.body.ficha.pesos.map(
        (peso: { grupo: string; peso: number }) => [peso.grupo, peso.peso],
      ),
    ).toEqual([
      ['MBA', 60],
      ['MBR', 40],
      ['MBG', 0],
    ]);
    expect(respuesta.body.ficha.galponesSugeridos).toBe(1);
  });

  it('RF17: el catálogo reparte los indicadores por grupo productivo', async () => {
    const visitaId = await programarVisita(tokenInspector);
    const respuesta = await obtener(tokenInspector, visitaId).expect(200);
    const catalogo = respuesta.body.catalogo as {
      indicadores: { codigo: string; gruposProductivos: string[] }[];
      aplicables: Record<string, string[]>;
    };

    for (const grupo of Object.keys(catalogo.aplicables)) {
      const esperados = catalogo.indicadores
        .filter((indicador) => indicador.gruposProductivos.includes(grupo))
        .map((indicador) => indicador.codigo);
      expect(catalogo.aplicables[grupo]).toEqual(esperados);
    }
    expect(
      catalogo.aplicables[GrupoProductivo.POLLO_ENGORDE].length,
    ).toBeGreaterThan(0);
  });

  it('RF13: reenviar el mismo borrador no duplica los galpones', async () => {
    const visitaId = await programarVisita(tokenInspector);
    const cuerpo = {
      numeroAves: 62000,
      galpones: [
        { numero: 1, edadSemanas: 60 },
        { numero: 2, edadSemanas: 30 },
      ],
    };

    await guardar(tokenInspector, visitaId, cuerpo).expect(200);
    const respuesta = await guardar(tokenInspector, visitaId, {
      ...cuerpo,
      galpones: [{ numero: 1, edadSemanas: 61 }],
    }).expect(200);

    expect(respuesta.body.galpones.length).toBe(1);
    expect(respuesta.body.galpones[0].edadSemanas).toBe(61);
  });

  it('RNF07: un inspector no diligencia visitas de otro inspector', async () => {
    const visitaId = await programarVisita(tokenInspector);
    await obtener(tokenOtroInspector, visitaId).expect(403);
    await guardar(tokenOtroInspector, visitaId, { numeroAves: 100 }).expect(
      403,
    );
  });

  it('RNF08: el rol Consulta puede ver la ficha pero no guardarla', async () => {
    const visitaId = await programarVisita(tokenInspector);
    await obtener(tokenConsulta, visitaId).expect(200);
    await guardar(tokenConsulta, visitaId, { numeroAves: 100 }).expect(403);
  });

  it('RF09: una visita cerrada no se puede editar', async () => {
    const visitaId = await programarVisita(tokenInspector);
    await servidor()
      .patch(`/api/v1/visitas/${visitaId}/estado`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ estado: EstadoVisita.EN_CURSO })
      .expect(200);
    await servidor()
      .patch(`/api/v1/visitas/${visitaId}/estado`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ estado: EstadoVisita.CERRADA })
      .expect(200);

    await guardar(tokenInspector, visitaId, { numeroAves: 100 }).expect(409);
  });

  it('RF12: la ficha también llega por la cola de sincronización', async () => {
    const visitaId = await programarVisita(tokenInspector);
    const operacionId = randomUUID();

    const respuesta = await servidor()
      .post('/api/v1/visitas/sincronizar')
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({
        operaciones: [
          {
            id: operacionId,
            tipo: 'GUARDAR_INSPECCION',
            visitaId,
            inspeccion: {
              numeroAves: 62000,
              grupoProductivo: GrupoProductivo.POLLO_ENGORDE,
              galpones: [{ numero: 1, edadSemanas: 62 }],
            },
            registradoEn: new Date().toISOString(),
          },
        ],
      })
      .expect(200);

    expect(respuesta.body.resultados[0]).toEqual({
      id: operacionId,
      estado: 'APLICADA',
    });

    const ficha = await obtener(tokenInspector, visitaId).expect(200);
    expect(ficha.body.predio.tipoPredio).toBe(TipoPredio.CORRAL);
    expect(ficha.body.ficha.grupoProductivo).toBe(
      GrupoProductivo.POLLO_ENGORDE,
    );
  });

  it('RF13: rechaza una fecha y hora que no son válidas', async () => {
    const visitaId = await programarVisita(tokenInspector);
    await guardar(tokenInspector, visitaId, {
      fechaHora: 'no-es-fecha',
    }).expect(400);
  });

  it('RF13: rechaza un número de aves con letras, decimales o negativo', async () => {
    const visitaId = await programarVisita(tokenInspector);

    const conLetras = await guardar(tokenInspector, visitaId, {
      numeroAves: 'muchas',
    }).expect(400);
    expect(String(conLetras.body.message)).toContain('entero');

    const conDecimales = await guardar(tokenInspector, visitaId, {
      numeroAves: 62000.5,
    }).expect(400);
    expect(String(conDecimales.body.message)).toContain('entero');

    const negativo = await guardar(tokenInspector, visitaId, {
      numeroAves: -1,
    }).expect(400);
    expect(String(negativo.body.message)).toContain('negativo');
  });

  it('RF16: rechaza un galpón con número o aves que no son enteros válidos', async () => {
    const visitaId = await programarVisita(tokenInspector);

    const numeroDecimal = await guardar(tokenInspector, visitaId, {
      galpones: [{ numero: 1.5 }],
    }).expect(400);
    expect(String(numeroDecimal.body.message)).toContain('entero');

    const numeroCero = await guardar(tokenInspector, visitaId, {
      galpones: [{ numero: 0 }],
    }).expect(400);
    expect(String(numeroCero.body.message)).toContain('al menos 1');

    const avesNegativas = await guardar(tokenInspector, visitaId, {
      galpones: [{ numero: 1, aves: -20 }],
    }).expect(400);
    expect(String(avesNegativas.body.message)).toContain('negativa');

    const avesDecimales = await guardar(tokenInspector, visitaId, {
      galpones: [{ numero: 1, aves: 12.5 }],
    }).expect(400);
    expect(String(avesDecimales.body.message)).toContain('entero');
  });

  it('RF16: rechaza dos galpones con el mismo número', async () => {
    const visitaId = await programarVisita(tokenInspector);

    const repetido = await guardar(tokenInspector, visitaId, {
      galpones: [
        { numero: 1, aves: 1000 },
        { numero: 1, aves: 2000 },
      ],
    }).expect(400);
    expect(String(repetido.body.message)).toContain('repetido');
  });

  // ------------------------------------------- M4 · Fase II (RF18–RF26)

  /** Ficha de Fase I lista para la Fase II: grupo, aves y galpones. */
  async function prepararFase2(
    grupo: GrupoProductivo = GrupoProductivo.POLLO_ENGORDE,
    numeroAves = 62000,
  ): Promise<string> {
    const visitaId = await programarVisita(tokenInspector);
    await guardar(tokenInspector, visitaId, {
      numeroAves,
      grupoProductivo: grupo,
      galpones: [
        { numero: 1, edadSemanas: 62, seleccionado: true },
        { numero: 2, edadSemanas: 40, seleccionado: true },
      ],
    }).expect(200);
    return visitaId;
  }

  /** Punto de piso válido (RF20). */
  const punto = (
    numero: number,
    puntaje: number | null,
    aves: number | null = 20,
  ) => ({ numero, puntaje, aves });

  it('RF18–RF19: guarda los puntos y muestra el cálculo en vivo', async () => {
    const visitaId = await prepararFase2();
    const respuesta = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-02',
          puntos: [punto(1, 2), punto(2, 2), punto(3, 1), punto(4, 1)],
        },
      ],
    }).expect(200);

    const fase2 = respuesta.body.fase2 as {
      reglas: { puntos: number; jaula: boolean; avesMin: number };
      evaluaciones: {
        indicadorCodigo: string;
        promedio: number;
        valor: number;
        puntosRegistrados: number;
        completo: boolean;
        guardadoEn: string;
        puntos: { numero: number; puntaje: number }[];
      }[];
      avance: {
        galponNumero: number;
        grupos: { grupo: string; completos: number; total: number }[];
      }[];
    };

    expect(fase2.reglas.puntos).toBe(9);
    expect(fase2.reglas.jaula).toBe(false);
    expect(fase2.reglas.avesMin).toBe(15);

    const evaluacion = fase2.evaluaciones.find(
      (fila) => fila.indicadorCodigo === 'MBR-02',
    );
    expect(evaluacion).toBeDefined();
    // El ejemplo del wireframe: (2+2+1+1)/4 = 1,5 → 75 %.
    expect(evaluacion?.promedio).toBe(1.5);
    expect(evaluacion?.valor).toBe(75);
    expect(evaluacion?.puntosRegistrados).toBe(4);
    expect(evaluacion?.completo).toBe(false);
    expect(evaluacion?.guardadoEn).toBeTruthy();
    expect(evaluacion?.puntos.length).toBe(4);

    const avance = fase2.avance.find((fila) => fila.galponNumero === 1);
    const mbr = avance?.grupos.find((grupo) => grupo.grupo === 'MBR');
    expect(mbr?.completos).toBe(0);
    expect(mbr?.total).toBe(9);
  });

  it('RF20: rechaza puntajes y muestras de piso fuera de rango', async () => {
    const visitaId = await prepararFase2();

    const puntajeTres = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        { galponNumero: 1, indicadorCodigo: 'MBR-02', puntos: [punto(1, 3)] },
      ],
    }).expect(400);
    expect(String(puntajeTres.body.message)).toContain(
      'puntaje debe ser 0, 1 o 2',
    );

    const pocasAves = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-02',
          puntos: [punto(1, 2, 10)],
        },
      ],
    }).expect(400);
    expect(String(pocasAves.body.message)).toContain('entre 15 y 30 aves');

    const muchasAves = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-02',
          puntos: [punto(1, 2, 40)],
        },
      ],
    }).expect(400);
    expect(String(muchasAves.body.message)).toContain('entre 15 y 30 aves');
  });

  it('RF21: en jaula exige contar las aves antes de calificar', async () => {
    const visitaId = await prepararFase2(GrupoProductivo.PONEDORA_JAULA);

    const sinConteo = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-02',
          puntos: [{ numero: 1, puntaje: 1, jaulas: 4 }],
        },
      ],
    }).expect(400);
    expect(String(sinConteo.body.message)).toContain('antes de calificar');

    const jaulasFueraDeRango = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-02',
          puntos: [{ numero: 1, puntaje: 1, jaulas: 6, aves: 15 }],
        },
      ],
    }).expect(400);
    expect(String(jaulasFueraDeRango.body.message)).toContain(
      'entre 3 y 5 jaulas',
    );

    const avesFueraDeRango = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-02',
          puntos: [{ numero: 1, puntaje: 1, jaulas: 4, aves: 25 }],
        },
      ],
    }).expect(400);
    expect(String(avesFueraDeRango.body.message)).toContain('entre 10 y 20');

    const correcta = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-02',
          puntos: [{ numero: 1, puntaje: 1, jaulas: 4, aves: 15 }],
        },
      ],
    }).expect(200);
    expect(correcta.body.fase2.reglas.jaula).toBe(true);
  });

  it('RF22: las hojas centinela completan con el mínimo del predio', async () => {
    const visitaId = await prepararFase2();

    const dosHojas = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-01',
          puntos: [punto(1, 2), punto(2, 1)],
        },
      ],
    }).expect(200);
    const conDos = dosHojas.body.fase2.evaluaciones.find(
      (fila: { indicadorCodigo: string }) => fila.indicadorCodigo === 'MBR-01',
    );
    expect(conDos.completo).toBe(false);

    const tresHojas = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-01',
          puntos: [punto(1, 2), punto(2, 1), punto(3, 2)],
        },
      ],
    }).expect(200);
    const conTres = tresHojas.body.fase2.evaluaciones.find(
      (fila: { indicadorCodigo: string }) => fila.indicadorCodigo === 'MBR-01',
    );
    expect(conTres.completo).toBe(true);

    // El catálogo dice cuáles se miden con hojas centinela (RF22).
    const catalogo = tresHojas.body.catalogo.indicadores as {
      codigo: string;
      tipoMuestreo: string;
    }[];
    expect(
      catalogo.find((indicador) => indicador.codigo === 'MBR-01')?.tipoMuestreo,
    ).toBe('HOJAS_CENTINELA');
  });

  it('RF25: «No aplica» exige motivo y sale del cálculo', async () => {
    const visitaId = await prepararFase2();

    const sinMotivo = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        { galponNumero: 1, indicadorCodigo: 'MBR-08', noAplica: true },
      ],
    }).expect(400);
    expect(String(sinMotivo.body.message)).toContain('motivo');

    const conMotivo = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-08',
          noAplica: true,
          motivoNoAplica: 'El galpón no tiene nidal',
        },
      ],
    }).expect(200);
    const evaluacion = conMotivo.body.fase2.evaluaciones.find(
      (fila: { indicadorCodigo: string }) => fila.indicadorCodigo === 'MBR-08',
    );
    expect(evaluacion.noAplica).toBe(true);
    expect(evaluacion.valor).toBeNull();
    expect(evaluacion.completo).toBe(true);
  });

  it('RF17: rechaza indicadores que no aplican, de gestión o de otro galpón', async () => {
    const visitaId = await prepararFase2();

    const deGestion = await guardar(tokenInspector, visitaId, {
      evaluaciones: [{ galponNumero: 1, indicadorCodigo: 'MBG-01' }],
    }).expect(400);
    expect(String(deGestion.body.message)).toContain('Fase III');

    const inexistente = await guardar(tokenInspector, visitaId, {
      evaluaciones: [{ galponNumero: 1, indicadorCodigo: 'XXX-99' }],
    }).expect(400);
    expect(String(inexistente.body.message)).toContain('no existe');

    const galponAjeno = await guardar(tokenInspector, visitaId, {
      evaluaciones: [{ galponNumero: 7, indicadorCodigo: 'MBR-02' }],
    }).expect(400);
    expect(String(galponAjeno.body.message)).toContain('no está registrado');
  });

  it('RF26: el borrador se guarda por partes y se reemplaza al reenviar', async () => {
    const visitaId = await prepararFase2();

    await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        { galponNumero: 1, indicadorCodigo: 'MBR-02', puntos: [punto(1, 2)] },
      ],
    }).expect(200);

    const respuesta = await guardar(tokenInspector, visitaId, {
      evaluaciones: [
        {
          galponNumero: 1,
          indicadorCodigo: 'MBR-02',
          puntos: [punto(1, 2), punto(2, 1)],
          observaciones: 'Cama revisada en dos puntos.',
        },
      ],
    }).expect(200);

    const evaluaciones = respuesta.body.fase2.evaluaciones.filter(
      (fila: { indicadorCodigo: string }) => fila.indicadorCodigo === 'MBR-02',
    );
    expect(evaluaciones.length).toBe(1);
    expect(evaluaciones[0].puntos.length).toBe(2);
    expect(evaluaciones[0].observaciones).toBe('Cama revisada en dos puntos.');
  });

  it('RF23: registra la evidencia, la confirma y la consulta con URL firmada', async () => {
    const visitaId = await prepararFase2();

    const creada = await servidor()
      .post(`/api/v1/inspeccion/${visitaId}/evidencias`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({
        galponNumero: 1,
        indicadorCodigo: 'MBR-02',
        nombre: 'cama.jpg',
        tipo: 'image/jpeg',
        tamano: 240000,
      })
      .expect(201);

    const evidenciaId = creada.body.evidencia.id as string;
    expect(creada.body.evidencia.confirmada).toBe(false);
    expect(String(creada.body.urlSubida)).toContain('firma=subida');

    const confirmada = await servidor()
      .post(`/api/v1/inspeccion/evidencias/${evidenciaId}/confirmar`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .expect(201);
    expect(confirmada.body.confirmada).toBe(true);

    const url = await servidor()
      .get(`/api/v1/inspeccion/evidencias/${evidenciaId}/url`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .expect(200);
    expect(String(url.body.url)).toContain('firma=descarga');

    const ficha = await obtener(tokenInspector, visitaId).expect(200);
    expect(ficha.body.fase2.evidencias.length).toBe(1);
    expect(ficha.body.fase2.evidencias[0].indicadorCodigo).toBe('MBR-02');

    await servidor()
      .delete(`/api/v1/inspeccion/evidencias/${evidenciaId}`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .expect(204);
    await servidor()
      .get(`/api/v1/inspeccion/evidencias/${evidenciaId}/url`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .expect(404);
  });

  it('RF23: rechaza evidencias de tipo o tamaño no admitidos y sin subir', async () => {
    const visitaId = await prepararFase2();
    const base = {
      galponNumero: 1,
      indicadorCodigo: 'MBR-02',
      nombre: 'archivo',
      tipo: 'image/jpeg',
      tamano: 240000,
    };

    const tipoMalo = await servidor()
      .post(`/api/v1/inspeccion/${visitaId}/evidencias`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ ...base, tipo: 'application/pdf' })
      .expect(400);
    expect(String(tipoMalo.body.message)).toContain('JPG');

    const pesada = await servidor()
      .post(`/api/v1/inspeccion/${visitaId}/evidencias`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({ ...base, tamano: 9 * 1024 * 1024 })
      .expect(400);
    expect(String(pesada.body.message)).toContain('8 MB');

    // El archivo nunca llegó al almacenamiento: no se puede confirmar.
    almacenamiento.simularSubida = false;
    const sinArchivo = await servidor()
      .post(`/api/v1/inspeccion/${visitaId}/evidencias`)
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send(base)
      .expect(201);
    almacenamiento.simularSubida = true;

    const confirmacion = await servidor()
      .post(
        `/api/v1/inspeccion/evidencias/${sinArchivo.body.evidencia.id}/confirmar`,
      )
      .set('Authorization', `Bearer ${tokenInspector}`)
      .expect(400);
    expect(String(confirmacion.body.message)).toContain('no llegó');
  });

  it('RNF07: un inspector no registra evidencias en visitas ajenas', async () => {
    const visitaId = await prepararFase2();
    await servidor()
      .post(`/api/v1/inspeccion/${visitaId}/evidencias`)
      .set('Authorization', `Bearer ${tokenOtroInspector}`)
      .send({
        galponNumero: 1,
        indicadorCodigo: 'MBR-02',
        nombre: 'cama.jpg',
        tipo: 'image/jpeg',
        tamano: 240000,
      })
      .expect(403);

    await servidor()
      .post(`/api/v1/inspeccion/${visitaId}/evidencias`)
      .set('Authorization', `Bearer ${tokenConsulta}`)
      .send({
        galponNumero: 1,
        indicadorCodigo: 'MBR-02',
        nombre: 'cama.jpg',
        tipo: 'image/jpeg',
        tamano: 240000,
      })
      .expect(403);
  });

  it('RF12: las evaluaciones también llegan por la cola de sincronización', async () => {
    const visitaId = await prepararFase2();
    const operacionId = randomUUID();

    const respuesta = await servidor()
      .post('/api/v1/visitas/sincronizar')
      .set('Authorization', `Bearer ${tokenInspector}`)
      .send({
        operaciones: [
          {
            id: operacionId,
            tipo: 'GUARDAR_INSPECCION',
            visitaId,
            inspeccion: {
              evaluaciones: [
                {
                  galponNumero: 1,
                  indicadorCodigo: 'MBR-02',
                  puntos: [punto(1, 2), punto(2, 2)],
                },
              ],
            },
            registradoEn: new Date().toISOString(),
          },
        ],
      })
      .expect(200);

    expect(respuesta.body.resultados[0]).toEqual({
      id: operacionId,
      estado: 'APLICADA',
    });

    const ficha = await obtener(tokenInspector, visitaId).expect(200);
    const evaluacion = ficha.body.fase2.evaluaciones.find(
      (fila: { indicadorCodigo: string }) => fila.indicadorCodigo === 'MBR-02',
    );
    expect(evaluacion.valor).toBe(100);
  });
});
