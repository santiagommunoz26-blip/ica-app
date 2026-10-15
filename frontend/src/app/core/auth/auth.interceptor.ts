import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Añade el token de acceso a cada petición y, si la API responde 401 con la
 * sesión todavía viva, intenta renovar el token una vez y repite la petición
 * (RF02, RNF07).
 *
 * No se reintenta en las rutas de autenticación para no provocar bucles.
 */
export const authInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const auth = inject(AuthService);

  const token = auth.tokenActual();
  const peticionConToken = token
    ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : peticion;

  return siguiente(peticionConToken).pipe(
    catchError((error: HttpErrorResponse) => {
      const puedeRenovar =
        error.status === 401 &&
        !!token &&
        !auth.esRutaDeAutenticacion(peticion.url);

      if (!puedeRenovar) return throwError(() => error);

      return auth.renovarToken().pipe(
        switchMap((tokenRenovado) =>
          siguiente(
            peticion.clone({
              setHeaders: { Authorization: `Bearer ${tokenRenovado}` },
            }),
          ),
        ),
        catchError(() => throwError(() => error)),
      );
    }),
  );
};
