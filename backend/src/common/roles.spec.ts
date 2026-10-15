import {
  ETIQUETA_ROL,
  PERMISOS,
  permisosDeRol,
  Rol,
  tienePermiso,
} from './roles.js';
import { huellaToken } from './huella-token.js';

describe('Roles y permisos (RF04, RNF08)', () => {
  it('el Administrador gestiona usuarios y el catálogo', () => {
    expect(tienePermiso(Rol.ADMINISTRADOR, PERMISOS.USUARIOS_GESTIONAR)).toBe(
      true,
    );
    expect(tienePermiso(Rol.ADMINISTRADOR, PERMISOS.CATALOGO_EDITAR)).toBe(
      true,
    );
  });

  it('el Inspector programa visitas e inspecciona, pero no edita el catálogo', () => {
    expect(tienePermiso(Rol.INSPECTOR, PERMISOS.VISITAS_CREAR)).toBe(true);
    expect(tienePermiso(Rol.INSPECTOR, PERMISOS.INSPECCION_REGISTRAR)).toBe(
      true,
    );
    expect(tienePermiso(Rol.INSPECTOR, PERMISOS.ACTA_GENERAR)).toBe(true);
    // El wireframe muestra esta casilla sin marcar para el Inspector.
    expect(tienePermiso(Rol.INSPECTOR, PERMISOS.CATALOGO_EDITAR)).toBe(false);
    expect(tienePermiso(Rol.INSPECTOR, PERMISOS.USUARIOS_GESTIONAR)).toBe(
      false,
    );
  });

  it('el rol Consulta solo ve resultados y reportes', () => {
    expect(tienePermiso(Rol.CONSULTA, PERMISOS.HISTORIAL_CONSULTAR)).toBe(true);
    expect(tienePermiso(Rol.CONSULTA, PERMISOS.REPORTES_CONSULTAR)).toBe(true);
    expect(tienePermiso(Rol.CONSULTA, PERMISOS.VISITAS_CREAR)).toBe(false);
    expect(tienePermiso(Rol.CONSULTA, PERMISOS.USUARIOS_GESTIONAR)).toBe(false);
  });

  it('marca los permisos concedidos y no concedidos de cada rol', () => {
    const delInspector = permisosDeRol(Rol.INSPECTOR);
    const catalogo = delInspector.find(
      (p) => p.clave === PERMISOS.CATALOGO_EDITAR,
    );

    expect(catalogo).toMatchObject({
      etiqueta: 'Editar catálogo de indicadores',
      concedido: false,
    });
  });

  it('cada rol tiene una etiqueta legible', () => {
    expect(Object.keys(ETIQUETA_ROL)).toHaveLength(3);
    expect(ETIQUETA_ROL[Rol.ADMINISTRADOR]).toBe('Administrador');
  });
});

describe('Huella de tokens (RNF07)', () => {
  it('es estable y no expone el token original', () => {
    const token = 'token-de-prueba-1234567890';
    const huella = huellaToken(token);

    expect(huella).toHaveLength(64);
    expect(huella).toBe(huellaToken(token));
    expect(huella).not.toContain(token);
  });

  it('cambia si cambia el token', () => {
    expect(huellaToken('uno')).not.toBe(huellaToken('dos'));
  });
});
