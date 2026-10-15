import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Publico } from '../common/decorators/acceso.decorators.js';
import { PermitePasswordTemporal } from '../common/decorators/password-temporal.decorator.js';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator.js';
import { contextoDePeticion } from '../common/contexto-peticion.js';
import type { UsuarioAutenticado } from '../common/interfaces/usuario-autenticado.interface.js';
import { AuthService } from './auth.service.js';
import {
  CambiarPasswordDto,
  RecuperarPasswordDto,
  RestablecerPasswordDto,
} from './dto/password.dto.js';
import { ConfigurarPinDto, VerificarPinDto } from './dto/pin.dto.js';
import {
  CerrarSesionDto,
  IniciarSesionDto,
  RefrescarSesionDto,
} from './dto/sesion.dto.js';
import {
  MensajeRespuestaDto,
  PinVerificadoRespuestaDto,
  SesionRespuestaDto,
} from './dto/sesion-respuesta.dto.js';

/**
 * Autenticación y sesión (M1 · RF01–RF03, RF06, RF07).
 *
 * Las rutas marcadas con @PermitePasswordTemporal() siguen disponibles cuando
 * el usuario debe cambiar su contraseña temporal (RF07); el resto de la API
 * queda bloqueado por el PasswordTemporalGuard.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión con correo y contraseña (RF01)' })
  @ApiOkResponse({ type: SesionRespuestaDto })
  iniciarSesion(@Body() dto: IniciarSesionDto, @Req() peticion: Request) {
    return this.auth.iniciarSesion(dto, contextoDePeticion(peticion));
  }

  @Publico()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renueva el token de acceso (RF02)' })
  @ApiOkResponse({ type: SesionRespuestaDto })
  refrescar(@Body() dto: RefrescarSesionDto, @Req() peticion: Request) {
    return this.auth.refrescarSesion(dto.token, contextoDePeticion(peticion));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @PermitePasswordTemporal()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cierra la sesión (RF02)' })
  @ApiOkResponse({ type: MensajeRespuestaDto })
  cerrarSesion(
    @Body() dto: CerrarSesionDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Req() peticion: Request,
  ) {
    return this.auth.cerrarSesion(dto, usuario, contextoDePeticion(peticion));
  }

  @Get('perfil')
  @PermitePasswordTemporal()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos y permisos del usuario de la sesión (RF04)' })
  async perfil(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.auth.perfil(usuario);
  }

  @Publico()
  @Post('recuperar-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicita el enlace de recuperación (RF06)' })
  @ApiOkResponse({ type: MensajeRespuestaDto })
  recuperarPassword(
    @Body() dto: RecuperarPasswordDto,
    @Req() peticion: Request,
  ) {
    return this.auth.solicitarRecuperacion(dto, contextoDePeticion(peticion));
  }

  @Publico()
  @Post('restablecer-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablece la contraseña con el token (RF06)' })
  @ApiOkResponse({ type: MensajeRespuestaDto })
  restablecerPassword(
    @Body() dto: RestablecerPasswordDto,
    @Req() peticion: Request,
  ) {
    return this.auth.restablecerPassword(dto, contextoDePeticion(peticion));
  }

  @Post('cambiar-password')
  @HttpCode(HttpStatus.OK)
  @PermitePasswordTemporal()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cambia la contraseña (obligatorio en el primer acceso, RF07)',
  })
  @ApiOkResponse({ type: MensajeRespuestaDto })
  cambiarPassword(
    @Body() dto: CambiarPasswordDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Req() peticion: Request,
  ) {
    return this.auth.cambiarPassword(
      usuario,
      dto,
      contextoDePeticion(peticion),
    );
  }

  @Put('pin')
  @PermitePasswordTemporal()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configura el PIN de acceso sin conexión (RF03)' })
  @ApiOkResponse({ type: MensajeRespuestaDto })
  configurarPin(
    @Body() dto: ConfigurarPinDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Req() peticion: Request,
  ) {
    return this.auth.configurarPin(usuario, dto, contextoDePeticion(peticion));
  }

  @Post('pin/verificar')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verifica el PIN con conexión (RF03)' })
  @ApiOkResponse({ type: PinVerificadoRespuestaDto })
  verificarPin(
    @Body() dto: VerificarPinDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Req() peticion: Request,
  ) {
    return this.auth.verificarPin(usuario, dto, contextoDePeticion(peticion));
  }
}
