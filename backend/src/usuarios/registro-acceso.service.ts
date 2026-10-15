import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EventoBitacora,
  RegistroAcceso,
} from './entities/registro-acceso.entity.js';
import type { ContextoPeticion } from '../common/interfaces/usuario-autenticado.interface.js';

interface DatosBitacora extends ContextoPeticion {
  usuarioId?: string | null;
  correo?: string | null;
  detalle?: string | null;
}

/**
 * Bitácora de auditoría (RNF11 y regla de M1 «cada ingreso queda registrado»).
 *
 * Solo expone escritura y lectura: no hay forma de modificar ni borrar una
 * entrada desde la aplicación.
 */
@Injectable()
export class RegistroAccesoService {
  constructor(
    @InjectRepository(RegistroAcceso)
    private readonly repositorio: Repository<RegistroAcceso>,
  ) {}

  /** Añade una entrada a la bitácora. Nunca lanza: auditar no debe tumbar la petición. */
  async registrar(
    evento: EventoBitacora,
    datos: DatosBitacora = {},
  ): Promise<void> {
    try {
      await this.repositorio.insert({
        evento,
        usuarioId: datos.usuarioId ?? null,
        correo: datos.correo ?? null,
        direccionIp: datos.direccionIp ?? null,
        agenteUsuario: datos.agenteUsuario ?? null,
        detalle: datos.detalle ?? null,
      });
    } catch {
      // La bitácora no debe romper la operación principal (por ejemplo, si la
      // base está momentáneamente caída). El error se descarta a propósito.
    }
  }

  /** Últimas entradas de la bitácora, de la más reciente a la más antigua. */
  async listar(opciones: {
    pagina?: number;
    porPagina?: number;
    usuarioId?: string;
    evento?: EventoBitacora;
  }): Promise<{ datos: RegistroAcceso[]; total: number }> {
    const pagina = opciones.pagina ?? 1;
    const porPagina = Math.min(opciones.porPagina ?? 20, 100);

    const [datos, total] = await this.repositorio.findAndCount({
      where: {
        ...(opciones.usuarioId ? { usuarioId: opciones.usuarioId } : {}),
        ...(opciones.evento ? { evento: opciones.evento } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    });

    return { datos, total };
  }
}
