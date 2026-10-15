import type { ContextoPeticion } from './interfaces/usuario-autenticado.interface.js';

/** Forma mínima de una petición HTTP que necesitamos para la bitácora. */
interface PeticionMinima {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Extrae la IP y el agente de usuario de la petición para la bitácora.
 * Si la API está detrás de un proxy (Cloud Run), `ip` ya viene con la cadena
 * de reenvío; se recorta a 45 caracteres (longitud máxima de una IPv6).
 */
export function contextoDePeticion(peticion: PeticionMinima): ContextoPeticion {
  const agente = peticion.headers['user-agent'];
  const ip = peticion.ip ?? peticion.socket?.remoteAddress;
  return {
    direccionIp: ip ? String(ip).slice(0, 45) : undefined,
    agenteUsuario:
      typeof agente === 'string' ? agente.slice(0, 255) : undefined,
  };
}
