import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { GuardarIndicadorDto } from './dto/guardar-indicador.dto.js';
import type { GuardarPesosDto } from './dto/guardar-pesos.dto.js';
import {
  IndicadorMetodologia,
  type EscalaIndicador,
  PUNTAJE_NO_APLICA_PREFIX,
} from './entities/indicador-metodologia.entity.js';
import { MetodologiaVersion } from './entities/metodologia-version.entity.js';
import { PesoGrupo } from './entities/peso-grupo.entity.js';
import { AuditoriaModulo } from '../common/entities/auditoria-modulo.entity.js';

@Injectable()
export class AdministracionDeLaMetodologiaService {
  constructor(
    @InjectRepository(MetodologiaVersion)
    private readonly versiones: Repository<MetodologiaVersion>,
    @InjectRepository(IndicadorMetodologia)
    private readonly indicadores: Repository<IndicadorMetodologia>,
    @InjectRepository(PesoGrupo)
    private readonly pesos: Repository<PesoGrupo>,
    private readonly dataSource: DataSource,
  ) {}

  async listarVersiones() {
    return this.versiones.find({ order: { createdAt: 'DESC' } });
  }

  async listarAuditoria() {
    return this.dataSource.getRepository(AuditoriaModulo).find({
      where: { modulo: 'M8' },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async obtenerCatalogo() {
    const version = await this.versiones.findOneBy({ activa: true });
    if (!version) throw new NotFoundException('No hay metodología activa.');
    const [indicadores, pesos] = await Promise.all([
      this.indicadores.find({
        where: { versionId: version.id },
        order: { grupoMedida: 'ASC', nombre: 'ASC' },
      }),
      this.pesos.find({
        where: { versionId: version.id },
        order: { tipoPredio: 'ASC', grupoMedida: 'ASC' },
      }),
    ]);
    return { version, indicadores, pesos };
  }

  crearIndicador(dto: GuardarIndicadorDto, actorId: string) {
    this.validarEscala(dto.escalaPuntaje);
    return this.nuevaVersion(actorId, 'INDICADOR_CREADO', async (manager, version, anteriores) => {
      if (anteriores.some((i) => i.clave === dto.clave)) {
        throw new UnprocessableEntityException('La clave del indicador ya existe.');
      }
      await manager.getRepository(IndicadorMetodologia).insert({
        clave: dto.clave,
        nombre: dto.nombre,
        grupoMedida: dto.grupoMedida,
        metodoEvaluacion: dto.metodoEvaluacion,
        gruposProductivos: dto.gruposProductivos,
        referenciaManual: dto.referenciaManual,
        escalaPuntaje: dto.escalaPuntaje,
        activo: dto.activo ?? true,
        versionId: version.id,
      });
      return { clave: dto.clave };
    });
  }

  actualizarIndicador(id: string, dto: GuardarIndicadorDto, actorId: string) {
    this.validarEscala(dto.escalaPuntaje);
    return this.nuevaVersion(actorId, 'INDICADOR_EDITADO', async (manager, version, anteriores) => {
      const anterior = anteriores.find((i) => i.id === id);
      if (!anterior) throw new NotFoundException('Indicador no encontrado en la versión activa.');
      if (anteriores.some((i) => i.id !== id && i.clave === dto.clave)) {
        throw new UnprocessableEntityException('La clave del indicador ya existe.');
      }
      await manager.getRepository(IndicadorMetodologia).update(
        { versionId: version.id, clave: anterior.clave },
        {
          clave: dto.clave,
          nombre: dto.nombre,
          grupoMedida: dto.grupoMedida,
          metodoEvaluacion: dto.metodoEvaluacion,
          gruposProductivos: dto.gruposProductivos,
          referenciaManual: dto.referenciaManual,
          escalaPuntaje: dto.escalaPuntaje,
          activo: dto.activo ?? anterior.activo,
        },
      );
      return { claveAnterior: anterior.clave, claveNueva: dto.clave };
    });
  }

  actualizarPesos(dto: GuardarPesosDto, actorId: string) {
    this.validarSumaPesos(dto);
    return this.nuevaVersion(actorId, 'PESOS_EDITADOS', async (manager, version) => {
      const repo = manager.getRepository(PesoGrupo);
      await repo.delete({ versionId: version.id, tipoPredio: dto.tipoPredio });
      await repo.insert(dto.pesos.map((peso) => ({
        grupoMedida: peso.grupoMedida,
        porcentaje: peso.porcentaje.toFixed(2),
        tipoPredio: dto.tipoPredio,
        versionId: version.id,
      })));
      return { tipoPredio: dto.tipoPredio, pesos: dto.pesos };
    });
  }

  async activarVersion(id: string, actorId: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(MetodologiaVersion);
      const version = await repo.findOneBy({ id });
      if (!version) throw new NotFoundException('Versión metodológica no encontrada.');
      await this.validarVersionCompleta(manager, id);
      await repo.update({ activa: true }, { activa: false });
      version.activa = true;
      await repo.save(version);
      await manager.getRepository(AuditoriaModulo).insert({
        actorId,
        modulo: 'M8',
        accion: 'VERSION_ACTIVADA',
        recursoId: id,
        detalle: { nombre: version.nombre },
      });
      return version;
    });
  }

  private async nuevaVersion(
    actorId: string,
    accion: string,
    cambiar: (
      manager: import('typeorm').EntityManager,
      nueva: MetodologiaVersion,
      indicadoresAnteriores: IndicadorMetodologia[],
    ) => Promise<Record<string, unknown>>,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const versiones = manager.getRepository(MetodologiaVersion);
      const activa = await versiones.findOneBy({ activa: true });
      if (!activa) throw new NotFoundException('No hay metodología activa.');
      const anteriores = await manager.getRepository(IndicadorMetodologia).findBy({
        versionId: activa.id,
      });
      const pesosAnteriores = await manager.getRepository(PesoGrupo).findBy({
        versionId: activa.id,
      });
      const nueva: MetodologiaVersion = await versiones.save({
        nombre: await this.siguienteNombre(versiones, activa.nombre),
        notas: `Derivada de ${activa.nombre}`,
        activa: false,
        creadaPor: actorId,
      });
      await manager.getRepository(IndicadorMetodologia).insert(
        anteriores.map((item) => ({
          clave: item.clave,
          nombre: item.nombre,
          grupoMedida: item.grupoMedida,
          metodoEvaluacion: item.metodoEvaluacion,
          gruposProductivos: item.gruposProductivos,
          referenciaManual: item.referenciaManual,
          escalaPuntaje: item.escalaPuntaje,
          activo: item.activo,
          versionId: nueva.id,
        })),
      );
      await manager.getRepository(PesoGrupo).insert(
        pesosAnteriores.map((item) => ({
          tipoPredio: item.tipoPredio,
          grupoMedida: item.grupoMedida,
          porcentaje: item.porcentaje,
          versionId: nueva.id,
        })),
      );
      const detalle = await cambiar(manager, nueva, anteriores);
      await this.validarVersionCompleta(manager, nueva.id);
      await versiones.update({ activa: true }, { activa: false });
      nueva.activa = true;
      await versiones.save(nueva);
      await manager.getRepository(AuditoriaModulo).insert({
        actorId,
        modulo: 'M8',
        accion,
        recursoId: nueva.id,
        detalle: { versionAnterior: activa.nombre, versionNueva: nueva.nombre, ...detalle },
      });
      return this.catalogoDeVersion(manager, nueva);
    });
  }

  private async catalogoDeVersion(
    manager: import('typeorm').EntityManager,
    version: MetodologiaVersion,
  ) {
    const [indicadores, pesos] = await Promise.all([
      manager.getRepository(IndicadorMetodologia).findBy({ versionId: version.id }),
      manager.getRepository(PesoGrupo).findBy({ versionId: version.id }),
    ]);
    return { version, indicadores, pesos };
  }

  private async siguienteNombre(
    repo: Repository<MetodologiaVersion>,
    base: string,
  ): Promise<string> {
    const ultima = await repo.find({ order: { createdAt: 'DESC' }, take: 1 });
    const secuencia = (ultima.length + 1).toString().padStart(3, '0');
    return `${base.split('.rev')[0]}.rev${secuencia}`;
  }

  private validarEscala(escala: EscalaIndicador): void {
    const puntajes = ['0', '1', '2'] as const;
    if (
      !escala ||
      puntajes.some((puntaje) =>
        typeof escala[puntaje] !== 'string' || escala[puntaje].trim().length === 0
      ) ||
      puntajes.some((puntaje) =>
        puntaje !== '1' && escala[puntaje].startsWith(PUNTAJE_NO_APLICA_PREFIX)
      ) ||
      (escala['1'].startsWith(PUNTAJE_NO_APLICA_PREFIX) &&
        escala['1'].trim().length <= PUNTAJE_NO_APLICA_PREFIX.length)
    ) {
      throw new UnprocessableEntityException(
        'Describa los puntajes 0 y 2. Si la metodología no define el puntaje 1, márquelo como [NO_APLICA].',
      );
    }
  }

  private validarSumaPesos(dto: GuardarPesosDto): void {
    const grupos = dto.pesos.map((peso) => peso.grupoMedida);
    if (
      grupos.length !== 3 ||
      new Set(grupos).size !== 3 ||
      ['MBA', 'MBR', 'MBG'].some((grupo) => !grupos.includes(grupo as never))
    ) {
      throw new UnprocessableEntityException(
        'Debe indicar una sola vez cada grupo MBA, MBR y MBG.',
      );
    }
    const suma = dto.pesos.reduce((total, peso) => total + Math.round(peso.porcentaje * 100), 0);
    if (suma !== 10_000) {
      throw new UnprocessableEntityException('Los pesos deben sumar exactamente 100 %.');
    }
  }

  private async validarVersionCompleta(
    manager: import('typeorm').EntityManager,
    versionId: string,
  ): Promise<void> {
    const pesos = await manager.getRepository(PesoGrupo).findBy({ versionId });
    for (const tipoPredio of ['CORRAL', 'TRASPATIO'] as const) {
      const porTipo = pesos.filter((peso) => peso.tipoPredio === tipoPredio);
      const suma = porTipo.reduce((total, peso) => total + Number(peso.porcentaje), 0);
      if (porTipo.length !== 3 || Math.abs(suma - 100) > 0.001) {
        throw new UnprocessableEntityException(
          `Los pesos para ${tipoPredio.toLowerCase()} deben incluir MBA, MBR y MBG, y sumar 100 %.`,
        );
      }
    }
  }
}
