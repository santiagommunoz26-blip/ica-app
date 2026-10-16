/**
 * Roles, permisos y reglas de acceso (RF04, RNF08).
 *
 * Los roles son fijos: los fijan los requisitos («el sistema debe manejar los
 * roles Administrador, Inspector y Consulta», RF04) y la tabla de roles del
 * documento de módulos. Por eso viven en el código y no en un catálogo
 * editable: la regla de «nada hardcodeado» (RNF17) aplica a la metodología
 * (indicadores, escalas, pesos), no a los roles del sistema.
 *
 * Cada usuario tiene exactamente un rol y sus permisos son los del rol (el
 * wireframe los muestra como casillas no editables).
 */

/** Roles del sistema. */
export enum Rol {
  ADMINISTRADOR = 'ADMINISTRADOR',
  INSPECTOR = 'INSPECTOR',
  CONSULTA = 'CONSULTA',
}

/** Estado de un usuario; un usuario inactivo no puede ingresar (RF05). */
export enum EstadoUsuario {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
}

/** Permisos granulares que la interfaz usa para limitar opciones (RF04). */
export const PERMISOS = {
  USUARIOS_GESTIONAR: 'usuarios:gestionar',
  CATALOGO_EDITAR: 'catalogo:editar',
  VISITAS_CONSULTAR: 'visitas:consultar',
  VISITAS_CREAR: 'visitas:crear',
  INSPECCION_REGISTRAR: 'inspeccion:registrar',
  ACTA_GENERAR: 'acta:generar',
  HISTORIAL_CONSULTAR: 'historial:consultar',
  REPORTES_CONSULTAR: 'reportes:consultar',
} as const;

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS];

/** Catálogo de permisos con su etiqueta para la interfaz. */
export const CATALOGO_PERMISOS: ReadonlyArray<{
  clave: Permiso;
  etiqueta: string;
}> = [
  { clave: PERMISOS.USUARIOS_GESTIONAR, etiqueta: 'Gestionar usuarios' },
  {
    clave: PERMISOS.CATALOGO_EDITAR,
    etiqueta: 'Editar catálogo de indicadores',
  },
  { clave: PERMISOS.VISITAS_CONSULTAR, etiqueta: 'Consultar visitas' },
  { clave: PERMISOS.VISITAS_CREAR, etiqueta: 'Crear y programar visitas' },
  { clave: PERMISOS.INSPECCION_REGISTRAR, etiqueta: 'Registrar inspección' },
  { clave: PERMISOS.ACTA_GENERAR, etiqueta: 'Generar acta PDF' },
  { clave: PERMISOS.HISTORIAL_CONSULTAR, etiqueta: 'Consultar historial' },
  { clave: PERMISOS.REPORTES_CONSULTAR, etiqueta: 'Ver resultados y reportes' },
];

/** Etiqueta legible de cada rol. */
export const ETIQUETA_ROL: Record<Rol, string> = {
  [Rol.ADMINISTRADOR]: 'Administrador',
  [Rol.INSPECTOR]: 'Inspector',
  [Rol.CONSULTA]: 'Consulta',
};

/**
 * Permisos por rol, según la tabla de roles del documento de módulos:
 * el Administrador gestiona usuarios, el catálogo, programa visitas y consulta
 * todo el historial; el Inspector programa y realiza sus visitas, inspecciona,
 * calcula y entrega el acta; el rol Consulta (propuesto) solo ve.
 *
 * «Consultar visitas» y «Crear y programar visitas» se separan en M2: la tabla
 * del módulo concede «Programar y realizar visitas» al Administrador y al
 * Inspector, y «ver» a los tres roles (el Inspector, solo las suyas).
 */
export const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
  [Rol.ADMINISTRADOR]: [
    PERMISOS.USUARIOS_GESTIONAR,
    PERMISOS.CATALOGO_EDITAR,
    PERMISOS.VISITAS_CONSULTAR,
    PERMISOS.VISITAS_CREAR,
    PERMISOS.HISTORIAL_CONSULTAR,
    PERMISOS.REPORTES_CONSULTAR,
  ],
  [Rol.INSPECTOR]: [
    PERMISOS.VISITAS_CONSULTAR,
    PERMISOS.VISITAS_CREAR,
    PERMISOS.INSPECCION_REGISTRAR,
    PERMISOS.ACTA_GENERAR,
    PERMISOS.HISTORIAL_CONSULTAR,
    PERMISOS.REPORTES_CONSULTAR,
  ],
  [Rol.CONSULTA]: [
    PERMISOS.VISITAS_CONSULTAR,
    PERMISOS.HISTORIAL_CONSULTAR,
    PERMISOS.REPORTES_CONSULTAR,
  ],
};

/** Indica si un rol tiene un permiso concreto. */
export function tienePermiso(rol: Rol, permiso: Permiso): boolean {
  return PERMISOS_POR_ROL[rol]?.includes(permiso) ?? false;
}

/** Permisos de un rol con su etiqueta, listos para la interfaz. */
export function permisosDeRol(rol: Rol) {
  const claves = new Set<Permiso>(PERMISOS_POR_ROL[rol] ?? []);
  return CATALOGO_PERMISOS.map((permiso) => ({
    ...permiso,
    concedido: claves.has(permiso.clave),
  }));
}
