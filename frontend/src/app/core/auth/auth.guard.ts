import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import type { Rol } from './auth.modelos';

/**
 * Exige una sesión activa. Si no la hay, lleva al inicio de sesión guardando
 * el destino para volver allí después (RF01, RNF07).
 */
export const sesionGuard: CanActivateFn = (ruta): boolean | UrlTree => {
  const auth = inject(AuthService);
  if (auth.autenticado()) return true;
  return inject(Router).createUrlTree(['/login'], {
    queryParams: { destino: `/${ruta.url.join('/')}` },
  });
};

/**
 * Exige que la contraseña temporal ya se haya cambiado (RF07). Si no, lleva a
 * la pantalla de cambio obligatorio; el servidor también lo bloquea.
 */
export const passwordVigenteGuard: CanActivateFn = (): boolean | UrlTree => {
  const auth = inject(AuthService);
  if (auth.autenticado() && auth.debeCambiarPassword()) {
    return inject(Router).createUrlTree(['/cambiar-password']);
  }
  return true;
};

/**
 * Limita una ruta a los roles indicados en `data.roles` (RF04, RNF08).
 * Si el usuario no tiene ninguno de esos roles se le lleva al panel.
 */
export const rolGuard: CanActivateFn = (ruta): boolean | UrlTree => {
  const rolesPermitidos = ruta.data['roles'] as Rol[] | undefined;
  const auth = inject(AuthService);

  if (!rolesPermitidos?.length) return true;
  const usuario = auth.usuario();
  if (usuario && rolesPermitidos.includes(usuario.rol)) return true;
  return inject(Router).createUrlTree(['/panel']);
};
