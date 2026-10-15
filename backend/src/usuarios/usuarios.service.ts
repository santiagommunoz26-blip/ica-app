import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, type FindOptionsWhere } from 'typeorm';
import { EstadoUsuario, Rol } from '../common/roles.js';
import { limpiarTexto, normalizarCorreo } from '../common/texto.js';
import {
  generarPasswordTemporal,
  hashearSecreto,
  problemasDePassword,
} from '../common/password.js';
import { Usuario } from './entities/usuario.entity.js';
import { RegistroAccesoService } from './registro-acceso.service.js';
import { EventoBitacora } from './entities/registro-acceso.entity.js';
import type { ContextoPeticion } from '../common/interfaces/usuario-autenticado.interface.js';
import type { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';
import type { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import type { ListarUsuariosDto } from './dto/listar-usuarios.dto.js';

/** Usuario con sus secretos, para uso interno de la autenticación. */
export interface UsuarioConSecretos extends Usuario {
  passwordHash: string;
  pinHash: string | null;
}

/**
 * Gestión de usuarios (RF05) y reglas de seguridad asociadas.
 *
 * Reglas de negocio implementadas aquí (además de las de los requisitos):
 * - no se puede inactivar la propia cuenta (evita quedarse fuera del sistema);
 * - no se puede dejar el sistema sin ningún administrador activo;
 * - el correo es único y no distingue mayúsculas.
 */
@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly repositorio: Repository<Usuario>,
    private readonly bitacora: RegistroAccesoService,
  ) {}

  /** Busca un usuario por id (sin secretos). */
  async buscarPorId(id: string): Promise<Usuario | null> {
    return this.repositorio.findOne({ where: { id } });
  }

  /** Busca un usuario por correo (sin secretos). */
  async buscarPorCorreo(correo: string): Promise<Usuario | null> {
    return this.repositorio.findOne({
      where: { correo: normalizarCorreo(correo) },
    });
  }

  /**
   * Busca por correo incluyendo los secretos. `select: false` en la entidad
   * obliga a pedirlos explícitamente; así nunca se filtran por descuido.
   */
  async buscarPorCorreoConSecretos(
    correo: string,
  ): Promise<UsuarioConSecretos | null> {
    return this.repositorio
      .createQueryBuilder('usuario')
      .addSelect(['usuario.passwordHash', 'usuario.pinHash'])
      .where('usuario.correo = :correo', { correo: normalizarCorreo(correo) })
      .getOne();
  }

  /** Busca por id incluyendo los secretos (para verificar la contraseña). */
  async buscarPorIdConSecretos(id: string): Promise<UsuarioConSecretos | null> {
    return this.repositorio
      .createQueryBuilder('usuario')
      .addSelect(['usuario.passwordHash', 'usuario.pinHash'])
      .where('usuario.id = :id', { id })
      .getOne();
  }

  /** Lista usuarios con paginación, búsqueda y filtros (RF05). */
  async listar(filtros: ListarUsuariosDto): Promise<{
    datos: Usuario[];
    total: number;
    pagina: number;
    porPagina: number;
  }> {
    const pagina = filtros.pagina ?? 1;
    const porPagina = Math.min(filtros.porPagina ?? 20, 100);
    const base: FindOptionsWhere<Usuario> = {
      ...(filtros.rol ? { rol: filtros.rol } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
    };

    const busqueda = filtros.busqueda?.trim();
    const where: FindOptionsWhere<Usuario> | FindOptionsWhere<Usuario>[] =
      busqueda
        ? [
            { ...base, nombreCompleto: ILike(`%${busqueda}%`) },
            { ...base, correo: ILike(`%${busqueda}%`) },
          ]
        : base;

    const [datos, total] = await this.repositorio.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    });

    return { datos, total, pagina, porPagina };
  }

  /**
   * Crea un usuario con contraseña temporal (RF05, RF07). Si el administrador
   * no envía contraseña, el sistema genera una segura.
   */
  async crear(
    dto: CrearUsuarioDto,
    contexto: ContextoPeticion & { actorId?: string },
  ): Promise<{ usuario: Usuario; passwordTemporal: string }> {
    const correo = normalizarCorreo(dto.correo);
    const existente = await this.buscarPorCorreo(correo);
    if (existente) {
      throw new ConflictException(
        `Ya existe un usuario con el correo ${correo}.`,
      );
    }

    const passwordTemporal = dto.passwordTemporal ?? generarPasswordTemporal();
    const problemas = problemasDePassword(passwordTemporal);
    if (problemas.length > 0) {
      throw new BadRequestException(
        `La contraseña temporal no cumple la política: ${problemas.join(', ')}.`,
      );
    }

    const usuario = this.repositorio.create({
      nombreCompleto: limpiarTexto(dto.nombreCompleto),
      correo,
      rol: dto.rol,
      estado: EstadoUsuario.ACTIVO,
      debeCambiarPassword: true,
      passwordHash: await hashearSecreto(passwordTemporal),
    });
    const guardado = await this.repositorio.save(usuario);

    await this.bitacora.registrar(EventoBitacora.USUARIO_CREADO, {
      ...contexto,
      usuarioId: guardado.id,
      correo: guardado.correo,
      detalle: `Rol ${guardado.rol}`,
    });

    return { usuario: guardado, passwordTemporal };
  }

  /** Edita nombre, correo o rol de un usuario (RF05). */
  async actualizar(
    id: string,
    dto: ActualizarUsuarioDto,
    contexto: ContextoPeticion & { actorId?: string },
  ): Promise<Usuario> {
    const usuario = await this.buscarPorId(id);
    if (!usuario) throw new NotFoundException('El usuario no existe.');

    const cambios: string[] = [];

    if (
      dto.nombreCompleto &&
      limpiarTexto(dto.nombreCompleto) !== usuario.nombreCompleto
    ) {
      usuario.nombreCompleto = limpiarTexto(dto.nombreCompleto);
      cambios.push('nombre');
    }

    if (dto.correo && normalizarCorreo(dto.correo) !== usuario.correo) {
      const correo = normalizarCorreo(dto.correo);
      const existente = await this.buscarPorCorreo(correo);
      if (existente && existente.id !== usuario.id) {
        throw new ConflictException(
          `Ya existe un usuario con el correo ${correo}.`,
        );
      }
      usuario.correo = correo;
      cambios.push('correo');
    }

    if (dto.rol && dto.rol !== usuario.rol) {
      await this.asegurarAdministradorActivo(usuario, {
        rol: dto.rol,
        estado: usuario.estado,
      });
      usuario.rol = dto.rol;
      cambios.push(`rol -> ${dto.rol}`);
    }

    if (cambios.length === 0) return usuario;

    const guardado = await this.repositorio.save(usuario);
    await this.bitacora.registrar(EventoBitacora.USUARIO_EDITADO, {
      ...contexto,
      usuarioId: guardado.id,
      correo: guardado.correo,
      detalle: `Cambios: ${cambios.join(', ')}`,
    });
    return guardado;
  }

  /** Activa o inactiva un usuario (RF05). */
  async cambiarEstado(
    id: string,
    estado: EstadoUsuario,
    contexto: ContextoPeticion & { actorId?: string },
  ): Promise<Usuario> {
    const usuario = await this.buscarPorId(id);
    if (!usuario) throw new NotFoundException('El usuario no existe.');
    if (usuario.estado === estado) return usuario;

    if (estado === EstadoUsuario.INACTIVO && contexto.actorId === usuario.id) {
      throw new BadRequestException('No puede inactivar su propia cuenta.');
    }

    await this.asegurarAdministradorActivo(usuario, {
      rol: usuario.rol,
      estado,
    });

    usuario.estado = estado;
    const guardado = await this.repositorio.save(usuario);
    await this.bitacora.registrar(EventoBitacora.USUARIO_ESTADO_CAMBIADO, {
      ...contexto,
      usuarioId: guardado.id,
      correo: guardado.correo,
      detalle: `Estado -> ${estado}`,
    });
    return guardado;
  }

  /** Guarda una contraseña ya validada y decide si debe cambiarse al entrar. */
  async establecerPassword(
    id: string,
    password: string,
    opciones: { debeCambiar: boolean },
  ): Promise<Usuario> {
    const usuario = await this.buscarPorId(id);
    if (!usuario) throw new NotFoundException('El usuario no existe.');
    usuario.passwordHash = await hashearSecreto(password);
    usuario.debeCambiarPassword = opciones.debeCambiar;
    return this.repositorio.save(usuario);
  }

  /** Guarda el hash del PIN de acceso sin conexión (RF03). */
  async establecerPin(id: string, pin: string): Promise<void> {
    await this.repositorio.update(id, {
      pinHash: await hashearSecreto(pin),
      pinActualizadoEn: new Date(),
    });
  }

  /**
   * Restablece la contraseña de un usuario desde la administración (RF05):
   * genera una contraseña temporal nueva y obliga a cambiarla al entrar.
   */
  async restablecerPasswordPorAdministrador(
    id: string,
    contexto: ContextoPeticion & { actorId?: string },
  ): Promise<{ usuario: Usuario; passwordTemporal: string }> {
    const usuario = await this.buscarPorId(id);
    if (!usuario) throw new NotFoundException('El usuario no existe.');

    const passwordTemporal = generarPasswordTemporal();
    usuario.passwordHash = await hashearSecreto(passwordTemporal);
    usuario.debeCambiarPassword = true;
    const guardado = await this.repositorio.save(usuario);

    await this.bitacora.registrar(
      EventoBitacora.PASSWORD_RESTABLECIDA_POR_ADMIN,
      {
        ...contexto,
        usuarioId: guardado.id,
        correo: guardado.correo,
      },
    );

    return { usuario: guardado, passwordTemporal };
  }

  /** Registra la fecha del último acceso correcto. */
  async actualizarUltimoAcceso(id: string): Promise<void> {
    await this.repositorio.update(id, { ultimoAcceso: new Date() });
  }

  /** Cuántos administradores activos hay (para no dejar el sistema sin acceso). */
  contarAdministradoresActivos(): Promise<number> {
    return this.repositorio.count({
      where: { rol: Rol.ADMINISTRADOR, estado: EstadoUsuario.ACTIVO },
    });
  }

  /**
   * Impide que la operación deje el sistema sin ningún administrador activo.
   * Se comprueba antes de editar el rol o el estado de un administrador.
   */
  private async asegurarAdministradorActivo(
    usuario: Usuario,
    nuevo: { rol: Rol; estado: EstadoUsuario },
  ): Promise<void> {
    const eraAdministradorActivo =
      usuario.rol === Rol.ADMINISTRADOR &&
      usuario.estado === EstadoUsuario.ACTIVO;
    const sigueSiendoAdministradorActivo =
      nuevo.rol === Rol.ADMINISTRADOR && nuevo.estado === EstadoUsuario.ACTIVO;

    if (!eraAdministradorActivo || sigueSiendoAdministradorActivo) return;

    const administradores = await this.contarAdministradoresActivos();
    if (administradores <= 1) {
      throw new BadRequestException(
        'No puede dejar el sistema sin administradores activos: cree o active otro administrador primero.',
      );
    }
  }
}
