import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { secretoJwt } from '../../common/configuracion.js';
import { EstadoUsuario } from '../../common/roles.js';
import { UsuariosService } from '../../usuarios/usuarios.service.js';
import type { PayloadJwt } from '../../common/interfaces/usuario-autenticado.interface.js';
import type { UsuarioAutenticado } from '../../common/interfaces/usuario-autenticado.interface.js';

/**
 * Estrategia de token de acceso (RNF07).
 *
 * En cada petición se vuelve a leer el usuario de la base para comprobar que
 * sigue existiendo y ACTIVO: así, inactivar a un usuario surte efecto de
 * inmediato (RF05) sin esperar a que caduque su token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly usuarios: UsuariosService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secretoJwt(config),
    });
  }

  async validate(payload: PayloadJwt): Promise<UsuarioAutenticado> {
    const usuario = await this.usuarios.buscarPorId(payload.sub);
    if (!usuario) {
      throw new UnauthorizedException('La sesión ya no es válida.');
    }
    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException(
        'El usuario está inactivo. Contacte al administrador.',
      );
    }
    return {
      id: usuario.id,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      rol: usuario.rol,
      debeCambiarPassword: usuario.debeCambiarPassword,
    };
  }
}
