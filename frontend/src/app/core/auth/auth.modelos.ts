/**
 * Modelos de autenticación y usuarios (M1 · RF01–RF07).
 * Reflejan lo que devuelve la API (ver backend/src/.../dto).
 */

/** Roles del sistema (RF04): cada usuario tiene exactamente uno. */
export type Rol = 'ADMINISTRADOR' | 'INSPECTOR' | 'CONSULTA';

/** Estado de un usuario; un usuario inactivo no puede ingresar (RF05). */
export type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

/** Permisos que la interfaz usa para limitar opciones (RF04). */
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

/** Etiqueta legible de cada permiso (igual que en el backend). */
export const ETIQUETA_PERMISO: Record<Permiso, string> = {
  [PERMISOS.USUARIOS_GESTIONAR]: 'Gestionar usuarios',
  [PERMISOS.CATALOGO_EDITAR]: 'Editar catálogo de indicadores',
  [PERMISOS.VISITAS_CONSULTAR]: 'Consultar visitas',
  [PERMISOS.VISITAS_CREAR]: 'Crear y programar visitas',
  [PERMISOS.INSPECCION_REGISTRAR]: 'Registrar inspección',
  [PERMISOS.ACTA_GENERAR]: 'Generar acta PDF',
  [PERMISOS.HISTORIAL_CONSULTAR]: 'Consultar historial',
  [PERMISOS.REPORTES_CONSULTAR]: 'Ver resultados y reportes',
};

/** Usuario tal como lo entrega la API (sin contraseña ni PIN). */
export interface Usuario {
  id: string;
  nombreCompleto: string;
  correo: string;
  rol: Rol;
  etiquetaRol: string;
  estado: EstadoUsuario;
  debeCambiarPassword: boolean;
  /** Si ya configuró su PIN de acceso sin conexión (RF03). */
  tienePin: boolean;
  ultimoAcceso: string | null;
  createdAt: string;
  permisos: Permiso[];
}

/** Respuesta de iniciar sesión o refrescarla (RF01, RF02). */
export interface SesionRespuesta {
  accessToken: string;
  refreshToken: string;
  expiraEnSegundos: number;
  refreshExpiraEnSegundos: number;
  /** Minutos de inactividad tras los cuales se cierra la sesión (RF02). */
  sesionInactividadMinutos: number;
  usuario: Usuario;
}

/** Datos para iniciar sesión (RF01). */
export interface PeticionIniciarSesion {
  correo: string;
  password: string;
  recordarme?: boolean;
}

/** Página de usuarios (RF05). */
export interface ListaUsuarios {
  datos: Usuario[];
  total: number;
  pagina: number;
  porPagina: number;
}

/** Filtros de la lista de usuarios. */
export interface FiltrosUsuarios {
  pagina?: number;
  porPagina?: number;
  busqueda?: string;
  rol?: Rol;
  estado?: EstadoUsuario;
}

/** Usuario creado; la contraseña temporal se muestra una sola vez (RF07). */
export interface UsuarioCreadoRespuesta {
  usuario: Usuario;
  passwordTemporal: string;
}

/** Datos para crear o editar un usuario (RF05). */
export interface PeticionCrearUsuario {
  nombreCompleto: string;
  correo: string;
  rol: Rol;
  passwordTemporal?: string;
}

/** Datos editables de un usuario (RF05). */
export interface PeticionActualizarUsuario {
  nombreCompleto?: string;
  correo?: string;
  rol?: Rol;
}

/** Permiso de un rol, con su etiqueta y si lo tiene concedido (RF04). */
export interface PermisoDeRol {
  clave: Permiso;
  etiqueta: string;
  concedido: boolean;
}

/** Catálogo de roles y permisos (RF04). */
export interface RolCatalogo {
  rol: Rol;
  etiqueta: string;
  permisos: PermisoDeRol[];
}

/** Entrada de la bitácora de auditoría (RNF11). */
export interface RegistroAcceso {
  id: string;
  usuarioId: string | null;
  correo: string | null;
  evento: string;
  direccionIp: string | null;
  detalle: string | null;
  createdAt: string;
}

/** Página de la bitácora de auditoría. */
export interface ListaBitacora {
  datos: RegistroAcceso[];
  total: number;
}

/** Indica si el usuario tiene un permiso concreto (RF04). */
export function tienePermiso(
  usuario: Usuario | null,
  permiso: Permiso,
): boolean {
  return usuario?.permisos?.includes(permiso) ?? false;
}

/**
 * Reglas de la política de contraseñas (decisión del proyecto, ver
 * backend/src/common/password.ts). Se usan para avisar en el formulario antes
 * de enviar.
 */
export const REGLAS_PASSWORD = [
  'Al menos 10 caracteres',
  'Una letra mayúscula',
  'Una letra minúscula',
  'Un número',
] as const;

/** Problemas de una contraseña, con el mismo criterio que el backend. */
export function problemasDePassword(password: string): string[] {
  const problemas: string[] = [];
  if (password.length < 10) problemas.push(REGLAS_PASSWORD[0]);
  if (!/[A-ZÁÉÍÓÚÑ]/.test(password)) problemas.push(REGLAS_PASSWORD[1]);
  if (!/[a-záéíóúñ]/.test(password)) problemas.push(REGLAS_PASSWORD[2]);
  if (!/\d/.test(password)) problemas.push(REGLAS_PASSWORD[3]);
  return problemas;
}
