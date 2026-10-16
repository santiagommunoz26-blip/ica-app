import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Indicador } from './entities/indicador.entity.js';
import { Metodologia } from './entities/metodologia.entity.js';
import { PesoGrupo } from './entities/peso-grupo.entity.js';
import type { CatalogoActivo } from './dto/catalogo-respuesta.dto.js';

/**
 * Lectura del catálogo de la metodología (M3 · RF14–RF17).
 *
 * Solo lee: la administración del catálogo (crear versiones, editar
 * indicadores, escalas y pesos) es de M8 (RF46–RF49). Aquí se resuelve la
 * versión **activa**, que es la que usa una inspección nueva; una visita ya
 * guardada conserva la versión con la que se hizo (RF49, ADR-001).
 */
@Injectable()
export class MetodologiaService {
  constructor(
    @InjectRepository(Metodologia)
    private readonly metodologias: Repository<Metodologia>,
    @InjectRepository(Indicador)
    private readonly indicadores: Repository<Indicador>,
    @InjectRepository(PesoGrupo)
    private readonly pesos: Repository<PesoGrupo>,
  ) {}

  /** Versión activa con sus indicadores y pesos; `null` si no hay catálogo. */
  async activa(): Promise<CatalogoActivo | null> {
    const metodologia = await this.metodologias.findOne({
      where: { activa: true },
      order: { vigenteDesde: 'DESC', createdAt: 'DESC' },
    });
    if (!metodologia) return null;

    const [indicadores, pesos] = await Promise.all([
      this.indicadores.find({ where: { metodologiaId: metodologia.id } }),
      this.pesos.find({ where: { metodologiaId: metodologia.id } }),
    ]);

    return { metodologia, indicadores, pesos };
  }

  /** Versión concreta por identificador (la que guardó una visita). */
  async porId(id: string): Promise<CatalogoActivo | null> {
    const metodologia = await this.metodologias.findOne({ where: { id } });
    if (!metodologia) return null;

    const [indicadores, pesos] = await Promise.all([
      this.indicadores.find({ where: { metodologiaId: id } }),
      this.pesos.find({ where: { metodologiaId: id } }),
    ]);

    return { metodologia, indicadores, pesos };
  }
}
