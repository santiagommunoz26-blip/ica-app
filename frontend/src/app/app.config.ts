import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

/**
 * Configuración de la aplicación.
 *
 * Antes de mostrar la interfaz se intenta restaurar la sesión (RF02): si hay
 * token de refresco se renueva, y si no hay conexión se conserva el perfil
 * para poder entrar con el PIN (RF03).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    {
      // Todos los campos de formulario se dibujan con contorno y con la
      // etiqueta flotando arriba. En Angular Material 18 la etiqueta solo
      // flota cuando el campo tiene foco o contenido (el «placeholder» ya no
      // la levanta), y quedaba dentro de la caja, superpuesta al ejemplo.
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline', floatLabel: 'always' },
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthService) => () => auth.restaurarSesion(),
      deps: [AuthService],
      multi: true,
    },
  ],
};
