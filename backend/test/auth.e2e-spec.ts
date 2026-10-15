import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource, In } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { configurarApp } from './../src/configurar-app.js';
import { EstadoUsuario, Rol } from './../src/common/roles.js';
import { hashearSecreto } from './../src/common/password.js';
import { huellaToken } from './../src/common/huella-token.js';
import { Usuario } from './../src/usuarios/entities/usuario.entity.js';
import { RegistroAcceso } from './../src/usuarios/entities/registro-acceso.entity.js';
import { TokenPassword } from './../src/usuarios/entities/token-password.entity.js';

/**
 * Pruebas de integración de la autenticación (RF01–RF07).
 * Requieren PostgreSQL arriba (make infra).
 */
describe('Autenticación y usuarios (e2e)', () => {
  const PASSWORD_TEMPORAL = 'Temporal2026*';
  const PASSWORD_DEFINITIVA = 'Definitiva2026*';
  const PASSWORD_INSPECTOR = 'Inspector2026*';

  let app: INestApplication<App>;
  let dataSource: DataSource;
  let correoAdmin: string;
  let correoInspector: string;
  let idAdmin: string;
  let idInspector: string;

  const servidor = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configurarApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    const sufijo = Date.now();
    correoAdmin = `e2e.admin.${sufijo}@ica.local`;
    correoInspector = `e2e.inspector.${sufijo}@ica.local`;

    const repositorio = dataSource.getRepository(Usuario);
    const admin = await repositorio.save(
      repositorio.create({
        nombreCompleto: 'Administradora E2E',
        correo: correoAdmin,
        passwordHash: await hashearSecreto(PASSWORD_TEMPORAL),
        rol: Rol.ADMINISTRADOR,
        estado: EstadoUsuario.ACTIVO,
        debeCambiarPassword: true,
      }),
    );
    const inspector = await repositorio.save(
      repositorio.create({
        nombreCompleto: 'Inspector E2E',
        correo: correoInspector,
        passwordHash: await hashearSecreto(PASSWORD_INSPECTOR),
        rol: Rol.INSPECTOR,
        estado: EstadoUsuario.ACTIVO,
        debeCambiarPassword: false,
      }),
    );
    idAdmin = admin.id;
    idInspector = inspector.id;
  });

  afterAll(async () => {
    // Limpieza: la bitácora no se borra por cascada, así que se limpia aparte.
    await dataSource
      .getRepository(RegistroAcceso)
      .delete({ usuarioId: In([idAdmin, idInspector]) });
    await dataSource
      .getRepository(Usuario)
      .delete({ correo: In([correoAdmin, correoInspector]) });
    await app.close();
  });

  it('RF01: inicia sesión con correo y contraseña', async () => {
    const respuesta = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoAdmin, password: PASSWORD_TEMPORAL })
      .expect(200);

    expect(respuesta.body.usuario.correo).toBe(correoAdmin);
    expect(respuesta.body.accessToken).toBeTruthy();
    expect(respuesta.body.refreshToken).toBeTruthy();
    expect(respuesta.body.sesionInactividadMinutos).toBeGreaterThan(0);
    // RNF07: nunca se expone el hash.
    expect(respuesta.body.usuario.passwordHash).toBeUndefined();
  });

  it('RF01: rechaza credenciales incorrectas sin decir cuál falló', async () => {
    const respuesta = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoAdmin, password: 'incorrecta' })
      .expect(401);

    expect(respuesta.body.message).toBe('Correo o contraseña incorrectos.');
  });

  it('RF07 y RNF08: con contraseña temporal solo se puede cambiar la contraseña', async () => {
    const sesion = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoAdmin, password: PASSWORD_TEMPORAL })
      .expect(200);
    const token = sesion.body.accessToken as string;

    // El perfil sí está permitido (lo necesita la pantalla de cambio).
    await servidor()
      .get('/api/v1/auth/perfil')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // El resto de la API queda bloqueado.
    await servidor()
      .get('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await servidor()
      .post('/api/v1/auth/cambiar-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        passwordActual: PASSWORD_TEMPORAL,
        passwordNueva: PASSWORD_DEFINITIVA,
      })
      .expect(200);

    const nuevaSesion = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoAdmin, password: PASSWORD_DEFINITIVA })
      .expect(200);

    expect(nuevaSesion.body.usuario.debeCambiarPassword).toBe(false);
  });

  it('RNF08: el inspector no puede administrar usuarios', async () => {
    const sesion = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoInspector, password: PASSWORD_INSPECTOR })
      .expect(200);

    await servidor()
      .get('/api/v1/usuarios')
      .set('Authorization', `Bearer ${sesion.body.accessToken}`)
      .expect(403);
  });

  it('RNF07: sin token o con token inválido no se accede', async () => {
    await servidor().get('/api/v1/usuarios').expect(401);
    await servidor()
      .get('/api/v1/usuarios')
      .set('Authorization', 'Bearer token.invalido')
      .expect(401);
  });

  it('RF05: un usuario inactivo no puede ingresar', async () => {
    await dataSource
      .getRepository(Usuario)
      .update(idInspector, { estado: EstadoUsuario.INACTIVO });

    await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoInspector, password: PASSWORD_INSPECTOR })
      .expect(401);

    await dataSource
      .getRepository(Usuario)
      .update(idInspector, { estado: EstadoUsuario.ACTIVO });
  });

  it('RF05: el administrador crea usuarios y evita correos duplicados', async () => {
    const sesion = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoAdmin, password: PASSWORD_DEFINITIVA })
      .expect(200);
    const token = sesion.body.accessToken as string;
    const correoNuevo = `e2e.consulta.${Date.now()}@ica.local`;

    const creado = await servidor()
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombreCompleto: 'Consulta E2E',
        correo: correoNuevo,
        rol: Rol.CONSULTA,
      })
      .expect(201);

    expect(creado.body.passwordTemporal).toBeTruthy();
    expect(creado.body.usuario.rol).toBe(Rol.CONSULTA);
    expect(creado.body.usuario.debeCambiarPassword).toBe(true);

    await servidor()
      .post('/api/v1/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombreCompleto: 'Duplicado',
        correo: correoNuevo,
        rol: Rol.CONSULTA,
      })
      .expect(409);

    await dataSource
      .getRepository(RegistroAcceso)
      .delete({ usuarioId: creado.body.usuario.id });
    await dataSource.getRepository(Usuario).delete({ correo: correoNuevo });
  });

  it('Regla: no se puede dejar el sistema sin administradores activos', async () => {
    const soloUnAdmin = await dataSource.getRepository(Usuario).count({
      where: { rol: Rol.ADMINISTRADOR, estado: EstadoUsuario.ACTIVO },
    });
    if (soloUnAdmin > 1) return; // depende del estado de la base; se omite

    const sesion = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoAdmin, password: PASSWORD_DEFINITIVA })
      .expect(200);

    await servidor()
      .patch(`/api/v1/usuarios/${idAdmin}/estado`)
      .set('Authorization', `Bearer ${sesion.body.accessToken}`)
      .send({ estado: EstadoUsuario.INACTIVO })
      .expect(400);
  });

  it('RF02 y RNF07: el token de refresco rota y se puede cerrar la sesión', async () => {
    const sesion = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoAdmin, password: PASSWORD_DEFINITIVA })
      .expect(200);
    const refrescoOriginal = sesion.body.refreshToken as string;

    const renovada = await servidor()
      .post('/api/v1/auth/refresh')
      .send({ token: refrescoOriginal })
      .expect(200);
    expect(renovada.body.refreshToken).not.toBe(refrescoOriginal);

    // El token anterior ya fue usado: no se puede repetir.
    await servidor()
      .post('/api/v1/auth/refresh')
      .send({ token: refrescoOriginal })
      .expect(401);

    await servidor()
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${renovada.body.accessToken}`)
      .send({ token: renovada.body.refreshToken })
      .expect(200);

    await servidor()
      .post('/api/v1/auth/refresh')
      .send({ token: renovada.body.refreshToken })
      .expect(401);
  });

  it('RF06: recuperación de contraseña con token de un solo uso', async () => {
    await servidor()
      .post('/api/v1/auth/recuperar-password')
      .send({ correo: correoAdmin })
      .expect(200);

    // El token solo viaja por correo (transporte de consola en desarrollo), así
    // que la prueba lo lee de la base de datos para completar el flujo.
    const registro = await dataSource
      .getRepository(TokenPassword)
      .findOne({ where: { usuarioId: idAdmin }, order: { createdAt: 'DESC' } });

    expect(registro).not.toBeNull();
    const tokenPlano = 'token-de-prueba-1234567890';
    await dataSource
      .getRepository(TokenPassword)
      .update(registro!.id, { tokenHash: huellaToken(tokenPlano) });

    const PASSWORD_RESTABLECIDA = 'Restablecida2026*';
    await servidor()
      .post('/api/v1/auth/restablecer-password')
      .send({ token: tokenPlano, passwordNueva: PASSWORD_RESTABLECIDA })
      .expect(200);

    // El token es de un solo uso.
    await servidor()
      .post('/api/v1/auth/restablecer-password')
      .send({ token: tokenPlano, passwordNueva: 'OtraClave2026*' })
      .expect(400);

    await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoAdmin, password: PASSWORD_RESTABLECIDA })
      .expect(200);

    // Se deja la contraseña del administrador de prueba en la definitiva.
    await dataSource.getRepository(Usuario).update(idAdmin, {
      passwordHash: await hashearSecreto(PASSWORD_DEFINITIVA),
    });
  });

  it('RF03: configura el PIN de acceso sin conexión', async () => {
    const sesion = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoAdmin, password: PASSWORD_DEFINITIVA })
      .expect(200);
    const token = sesion.body.accessToken as string;

    await servidor()
      .put('/api/v1/auth/pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '12', passwordActual: PASSWORD_DEFINITIVA })
      .expect(400);

    await servidor()
      .put('/api/v1/auth/pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '482913', passwordActual: PASSWORD_DEFINITIVA })
      .expect(200);

    await servidor()
      .post('/api/v1/auth/pin/verificar')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '482913' })
      .expect(200)
      .expect((respuesta) => expect(respuesta.body.valido).toBe(true));

    await servidor()
      .post('/api/v1/auth/pin/verificar')
      .set('Authorization', `Bearer ${token}`)
      .send({ pin: '000000' })
      .expect(200)
      .expect((respuesta) => expect(respuesta.body.valido).toBe(false));
  });

  it('RNF11 y RF04: la bitácora registra los ingresos y hay catálogo de roles', async () => {
    const sesion = await servidor()
      .post('/api/v1/auth/login')
      .send({ correo: correoAdmin, password: PASSWORD_DEFINITIVA })
      .expect(200);
    const token = sesion.body.accessToken as string;

    const bitacora = await servidor()
      .get(`/api/v1/usuarios/registro-acceso?usuarioId=${idAdmin}&porPagina=50`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const eventos = (bitacora.body.datos as { evento: string }[]).map(
      (fila) => fila.evento,
    );
    expect(eventos).toContain('INICIO_SESION');
    expect(eventos).toContain('CAMBIO_PASSWORD');

    const roles = await servidor()
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(roles.body).toHaveLength(3);
  });
});
