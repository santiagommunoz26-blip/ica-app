import { SetMetadata } from '@nestjs/common';

/** Clave de metadatos de las rutas permitidas con contraseña temporal. */
export const CLAVE_PERMITE_PASSWORD_TEMPORAL = 'permitePasswordTemporal';

/**
 * Marca las rutas que un usuario puede usar aunque todavía tenga una
 * contraseña temporal (cambiarla, consultar su perfil o cerrar sesión).
 *
 * Todo lo demás queda bloqueado hasta que la cambie: así RF07 («obligar a
 * cambiar la contraseña temporal en el primer acceso») se cumple en el
 * servidor, no solo en la interfaz.
 */
export const PermitePasswordTemporal = () =>
  SetMetadata(CLAVE_PERMITE_PASSWORD_TEMPORAL, true);
