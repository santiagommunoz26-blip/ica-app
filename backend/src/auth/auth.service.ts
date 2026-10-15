import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  esPinValido,
  generarTokenOpaco,
  hashearSecreto,
  problemasDePassword,
  verificarSecreto,
  LONGITUD_PIN,
} from '../common/password.js';
import { huellaToken } from '../common/huella-token.js';
import { normalizarCorreo } from '../common/texto.js';
import { EstadoUsuario } from '../common/roles.js';
import { EventoBitacora } from '../usuarios/entities/registro-acceso.entity.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import type { Usuario } from '../usuarios/entities/usuario.entity.js';
import { RegistroAccesoService } from '../usuarios/registro-acceso.service.js';
import { mapearUsuario } from '../usuarios/dto/usuario-respuesta.dto.js';
import type { UsuarioRespuestaDto } from '../usuarios/dto/usuario-respuesta.dto.js';
import { SesionesService } from './sesiones.service.js';
import { TokensPasswordService } from './tokens-password.service.js';
import { CorreoService } from './correo.service.js';
import type {
  ContextoPeticion,
  PayloadJwt,
  UsuarioAutenticado,
} from '../common/interfaces/usuario-autenticado.interface.js';
import type {
  CambiarPasswordDto,
  RecuperarPasswordDto,
  RestablecerPasswordDto,
} from './dto/password.dto.js';
import type { CerrarSesionDto, IniciarSesionDto } from './dto/sesion.dto.js';
import type { ConfigurarPinDto, VerificarPinDto } from './dto/pin.dto.js';

const SEGUNDOS_POR_DIA = 86_400;

/** Lo que devuelve emitir una sesión nueva. */
export interface SesionEmitida {
  accessToken: string;
  refreshToken: string;
  expiraEnSegundos: number;
  refreshExpiraEnSegundos: number;
}

/** Respuesta completa al iniciar sesión o refrescarla. */
export interface RespuestaSesion extends SesionEmitida {
  sesionInactividadMinutos: number;
  usuario: UsuarioRespuestaDto;
}

/**
 * Autenticación (M1 · RF01–RF03, RF06, RF07).
 *
 * Decisiones registradas en ADR-002: JWT propio con argon2id, token de
 * refresco opaco y rotado, y PIN para el trabajo sin conexión.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Hash de relleno para igualar tiempos cuando el correo no existe. */
  private hashSenuelo?: string;

  constructor(
    private readonly usuarios: UsuariosService,
    private readonly sesiones: SesionesService,
    private readonly tokens: TokensPasswordService,
    private readonly correo: CorreoService,
    private readonly bitacora: RegistroAccesoService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Minutos de inactividad antes de cerrar la sesión (RF02). */
  get sesionInactividadMinutos(): number {
    return this.leerNumero('SESION_INACTIVIDAD_MINUTOS', 30);
  }

  private get expiracionAccesoSegundos(): number {
    return this.leerNumero('JWT_EXPIRACION_ACCESO_SEGUNDOS', 900);
  }

  private get duracionRefrescoSegundos(): number {
    return this.leerNumero('JWT_REFRESH_DIAS', 7) * SEGUNDOS_POR_DIA;
  }

  private get duracionRefrescoRecordarSegundos(): number {
    return this.leerNumero('JWT_REFRESH_DIAS_RECORDAR', 30) * SEGUNDOS_POR_DIA;
  }

  private get minutosRecuperacion(): number {
    return this.leerNumero('PASSWORD_RECUPERACION_MINUTOS', 30);
  }

  private leerNumero(nombre: string, porDefecto: number): number {
    const valor = Number(this.config.get<string>(nombre) ?? porDefecto);
    return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
  }

  // ---------------------------------------------------------------- sesión

  /** Inicia sesión con correo y contraseña (RF01). */
  async iniciarSesion(
    dto: IniciarSesionDto,
    contexto: ContextoPeticion,
  ): Promise<RespuestaSesion> {
    const correo = normalizarCorreo(dto.correo);
    const usuario = await this.usuarios.buscarPorCorreoConSecretos(correo);

    // Se verifica siempre, incluso si el usuario no existe (contra un hash de
    // relleno), para no revelar por tiempo de respuesta qué correos existen.
    const hash = usuario?.passwordHash ?? (await this.obtenerHashSenuelo());
    const passwordCorrecta = await verificarSecreto(hash, dto.password);

    if (!usuario || !passwordCorrecta) {
      await this.bitacora.registrar(EventoBitacora.INICIO_SESION_FALLIDO, {
        ...contexto,
        usuarioId: usuario?.id ?? null,
        correo,
        detalle: 'Credenciales incorrectas',
      });
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      await this.bitacora.registrar(EventoBitacora.INICIO_SESION_FALLIDO, {
        ...contexto,
        usuarioId: usuario.id,
        correo,
        detalle: 'Usuario inactivo',
      });
      throw new UnauthorizedException(
        'El usuario está inactivo. Contacte al administrador.',
      );
    }

    const duracion = dto.recordarme
      ? this.duracionRefrescoRecordarSegundos
      : this.duracionRefrescoSegundos;
    const sesion = await this.emitirSesion(usuario, contexto, duracion);

    await this.usuarios.actualizarUltimoAcceso(usuario.id);
    await this.bitacora.registrar(EventoBitacora.INICIO_SESION, {
      ...contexto,
      usuarioId: usuario.id,
      correo,
    });

    return {
      ...sesion,
      sesionInactividadMinutos: this.sesionInactividadMinutos,
      usuario: mapearUsuario({ ...usuario, ultimoAcceso: new Date() }),
    };
  }

  /** Renueva el token de acceso rotando el de refresco (RF02, RNF07). */
  async refrescarSesion(
    token: string,
    contexto: ContextoPeticion,
  ): Promise<RespuestaSesion> {
    const sesion = await this.sesiones.buscarPorHuella(huellaToken(token));
    if (!sesion) {
      throw new UnauthorizedException('La sesión no es válida.');
    }
    if (sesion.revocadaEn || sesion.expiraEn.getTime() <= Date.now()) {
      throw new UnauthorizedException(
        'La sesión expiró. Inicie sesión de nuevo.',
      );
    }
    const usuario = sesion.usuario;
    if (!usuario || usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException(
        'El usuario está inactivo. Contacte al administrador.',
      );
    }

    // Rotación: la sesión anterior se revoca y se emite una nueva con la
    // misma duración que tenía (conserva «recordarme»).
    const duracion = Math.max(
      sesion.expiraEn.getTime() - sesion.createdAt.getTime(),
      this.duracionRefrescoSegundos,
    );
    await this.sesiones.revocar(sesion);
    const nueva = await this.emitirSesion(usuario, contexto, duracion);

    return {
      ...nueva,
      sesionInactividadMinutos: this.sesionInactividadMinutos,
      usuario: mapearUsuario(usuario),
    };
  }

  /** Cierra la sesión indicada (o todas las del usuario) (RF02). */
  async cerrarSesion(
    dto: CerrarSesionDto,
    usuario: UsuarioAutenticado,
    contexto: ContextoPeticion,
  ): Promise<{ mensaje: string }> {
    if (dto.token) {
      const sesion = await this.sesiones.buscarPorHuella(
        huellaToken(dto.token),
      );
      if (sesion && sesion.usuarioId === usuario.id) {
        await this.sesiones.revocar(sesion);
      }
    } else {
      await this.sesiones.revocarTodasDeUsuario(usuario.id);
    }

    await this.bitacora.registrar(EventoBitacora.CIERRE_SESION, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
      detalle: dto.token ? 'Sesión actual' : 'Todas las sesiones',
    });
    return { mensaje: 'Sesión cerrada.' };
  }

  /** Perfil del usuario de la sesión, con sus permisos (RF04). */
  async perfil(usuario: UsuarioAutenticado) {
    const entidad = await this.usuarios.buscarPorId(usuario.id);
    if (!entidad) {
      throw new UnauthorizedException('La sesión ya no es válida.');
    }
    return {
      usuario: mapearUsuario(entidad),
      sesionInactividadMinutos: this.sesionInactividadMinutos,
    };
  }

  // ------------------------------------------------------- contraseña (RF06/RF07)

  /**
   * Solicita la recuperación de contraseña (RF06). Siempre responde lo mismo,
   * exista o no el correo, para no revelar qué cuentas hay registradas.
   */
  async solicitarRecuperacion(
    dto: RecuperarPasswordDto,
    contexto: ContextoPeticion,
  ): Promise<{ mensaje: string }> {
    const correo = normalizarCorreo(dto.correo);
    const usuario = await this.usuarios.buscarPorCorreo(correo);

    if (usuario && usuario.estado === EstadoUsuario.ACTIVO) {
      const { token } = await this.tokens.crear(
        usuario.id,
        this.minutosRecuperacion,
      );
      await this.correo.enviarRecuperacionPassword({
        destinatario: usuario.correo,
        nombre: usuario.nombreCompleto,
        token,
      });
      await this.bitacora.registrar(
        EventoBitacora.PASSWORD_RECUPERACION_SOLICITADA,
        {
          ...contexto,
          usuarioId: usuario.id,
          correo,
          detalle: `Vigencia ${this.minutosRecuperacion} minutos`,
        },
      );
    } else {
      await this.bitacora.registrar(
        EventoBitacora.PASSWORD_RECUPERACION_SOLICITADA,
        {
          ...contexto,
          correo,
          detalle: 'Correo no registrado o inactivo',
        },
      );
    }

    return {
      mensaje:
        'Si el correo está registrado, recibirá las instrucciones para restablecer su contraseña.',
    };
  }

  /** Restablece la contraseña con el token de un solo uso (RF06). */
  async restablecerPassword(
    dto: RestablecerPasswordDto,
    contexto: ContextoPeticion,
  ): Promise<{ mensaje: string }> {
    this.exigirPoliticaPassword(dto.passwordNueva);

    const registro = await this.tokens.buscarVigente(huellaToken(dto.token));
    if (!registro) {
      throw new BadRequestException(
        'El enlace no es válido o ya venció. Solicite uno nuevo.',
      );
    }

    const usuario = await this.usuarios.buscarPorId(registro.usuarioId);
    if (!usuario || usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new BadRequestException('El enlace no es válido.');
    }

    await this.usuarios.establecerPassword(usuario.id, dto.passwordNueva, {
      debeCambiar: false,
    });
    await this.tokens.marcarUsado(registro.id);
    await this.tokens.invalidarPendientes(usuario.id);
    // Por seguridad, cualquier sesión abierta con la contraseña anterior se cierra.
    await this.sesiones.revocarTodasDeUsuario(usuario.id);

    await this.bitacora.registrar(EventoBitacora.PASSWORD_RESTABLECIDA, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
    });

    return { mensaje: 'Contraseña restablecida. Ya puede iniciar sesión.' };
  }

  /** Cambia la contraseña del usuario autenticado (RF07 y cambio voluntario). */
  async cambiarPassword(
    usuario: UsuarioAutenticado,
    dto: CambiarPasswordDto,
    contexto: ContextoPeticion,
  ): Promise<{ mensaje: string }> {
    const entidad = await this.usuarios.buscarPorIdConSecretos(usuario.id);
    if (!entidad) {
      throw new UnauthorizedException('La sesión ya no es válida.');
    }

    const actualCorrecta = await verificarSecreto(
      entidad.passwordHash,
      dto.passwordActual,
    );
    if (!actualCorrecta) {
      await this.bitacora.registrar(EventoBitacora.CAMBIO_PASSWORD, {
        ...contexto,
        usuarioId: usuario.id,
        correo: usuario.correo,
        detalle: 'Rechazado: la contraseña actual no es correcta',
      });
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }

    if (dto.passwordActual === dto.passwordNueva) {
      throw new BadRequestException(
        'La contraseña nueva debe ser distinta de la actual.',
      );
    }
    this.exigirPoliticaPassword(dto.passwordNueva);

    await this.usuarios.establecerPassword(usuario.id, dto.passwordNueva, {
      debeCambiar: false,
    });
    await this.bitacora.registrar(EventoBitacora.CAMBIO_PASSWORD, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
    });

    return { mensaje: 'Contraseña actualizada correctamente.' };
  }

  // ------------------------------------------------------- PIN sin conexión (RF03)

  /** Configura el PIN de acceso sin conexión (RF03). */
  async configurarPin(
    usuario: UsuarioAutenticado,
    dto: ConfigurarPinDto,
    contexto: ContextoPeticion,
  ): Promise<{ mensaje: string }> {
    if (!esPinValido(dto.pin)) {
      throw new BadRequestException(
        `El PIN debe tener exactamente ${LONGITUD_PIN} dígitos.`,
      );
    }

    const entidad = await this.usuarios.buscarPorIdConSecretos(usuario.id);
    if (!entidad) {
      throw new UnauthorizedException('La sesión ya no es válida.');
    }
    const correcta = await verificarSecreto(
      entidad.passwordHash,
      dto.passwordActual,
    );
    if (!correcta) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }

    await this.usuarios.establecerPin(usuario.id, dto.pin);
    await this.bitacora.registrar(EventoBitacora.PIN_CONFIGURADO, {
      ...contexto,
      usuarioId: usuario.id,
      correo: usuario.correo,
    });

    return {
      mensaje:
        'PIN configurado. Podrá entrar con él en este equipo cuando no tenga conexión.',
    };
  }

  /**
   * Verifica el PIN con conexión (RF03). La comprobación real del PIN sin
   * conexión la hace la aplicación en el equipo; este endpoint sirve para
   * validar el PIN mientras hay red.
   */
  async verificarPin(
    usuario: UsuarioAutenticado,
    dto: VerificarPinDto,
    contexto: ContextoPeticion,
  ): Promise<{ valido: boolean }> {
    const entidad = await this.usuarios.buscarPorIdConSecretos(usuario.id);
    if (!entidad?.pinHash) {
      throw new BadRequestException(
        'Todavía no ha configurado un PIN en este equipo.',
      );
    }

    const valido = await verificarSecreto(entidad.pinHash, dto.pin);
    await this.bitacora.registrar(
      valido ? EventoBitacora.PIN_VERIFICADO : EventoBitacora.PIN_FALLIDO,
      {
        ...contexto,
        usuarioId: usuario.id,
        correo: usuario.correo,
      },
    );
    return { valido };
  }

  // ------------------------------------------------------------- internos

  /** Firma el token de acceso y abre una sesión con token de refresco. */
  private async emitirSesion(
    usuario: Pick<Usuario, 'id' | 'correo' | 'rol'>,
    contexto: ContextoPeticion,
    duracionSegundos: number,
  ): Promise<SesionEmitida> {
    const payload: PayloadJwt = {
      sub: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.expiracionAccesoSegundos,
    });

    const refreshToken = generarTokenOpaco();
    await this.sesiones.crear({
      usuarioId: usuario.id,
      tokenHash: huellaToken(refreshToken),
      expiraEn: new Date(Date.now() + duracionSegundos * 1000),
      direccionIp: contexto.direccionIp,
      agenteUsuario: contexto.agenteUsuario,
    });

    return {
      accessToken,
      refreshToken,
      expiraEnSegundos: this.expiracionAccesoSegundos,
      refreshExpiraEnSegundos: duracionSegundos,
    };
  }

  private exigirPoliticaPassword(password: string): void {
    const problemas = problemasDePassword(password);
    if (problemas.length > 0) {
      throw new BadRequestException(
        `La contraseña no cumple la política de seguridad: ${problemas.join(', ')}.`,
      );
    }
  }

  /** Hash de relleno, calculado una sola vez y guardado en memoria. */
  private async obtenerHashSenuelo(): Promise<string> {
    this.hashSenuelo ??= await hashearSecreto(generarTokenOpaco());
    return this.hashSenuelo;
  }
}
