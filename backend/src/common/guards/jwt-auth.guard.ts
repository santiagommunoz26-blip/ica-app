import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CLAVE_PUBLICO } from '../decorators/acceso.decorators.js';

/**
 * Exige un token de acceso válido en todas las rutas, salvo las marcadas con
 * @Publico(). Se registra como guarda global en AppModule (RNF07, RNF08).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(contexto: ExecutionContext) {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) return true;
    return super.canActivate(contexto);
  }
}
