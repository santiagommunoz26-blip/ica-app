import { Routes } from '@angular/router';
import {
  passwordVigenteGuard,
  rolGuard,
  sesionGuard,
} from './core/auth/auth.guard';

/**
 * Rutas de la aplicación (M1).
 *
 * - `login` y `restablecer-password` son públicas.
 * - `cambiar-password` exige sesión (RF07: es la única pantalla disponible
 *   cuando la contraseña es temporal).
 * - El armazón con el panel y la administración exige sesión y la contraseña
 *   ya cambiada; la administración de usuarios exige rol Administrador.
 *
 * Los componentes se cargan de forma diferida para no engordar el paquete
 * inicial.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Ingresar · EBA Aves',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'restablecer-password',
    title: 'Restablecer contraseña · EBA Aves',
    loadComponent: () =>
      import('./pages/restablecer-password/restablecer-password.component').then(
        (m) => m.RestablecerPasswordComponent,
      ),
  },
  {
    path: 'cambiar-password',
    title: 'Cambiar contraseña · EBA Aves',
    canActivate: [sesionGuard],
    loadComponent: () =>
      import('./pages/cambiar-password/cambiar-password.component').then(
        (m) => m.CambiarPasswordComponent,
      ),
  },
  {
    path: '',
    canActivate: [sesionGuard, passwordVigenteGuard],
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'panel' },
      {
        path: 'panel',
        title: 'Panel · EBA Aves',
        loadComponent: () =>
          import('./pages/panel/panel.component').then((m) => m.PanelComponent),
      },
      {
        path: 'visitas',
        title: 'Visitas · EBA Aves',
        loadComponent: () =>
          import('./pages/visitas/visitas.component').then(
            (m) => m.VisitasComponent,
          ),
      },
      {
        path: 'inspeccion',
        title: 'Inspección · EBA Aves',
        canActivate: [rolGuard],
        data: { roles: ['INSPECTOR', 'ADMINISTRADOR'] },
        loadComponent: () =>
          import('./pages/inspeccion/inspeccion.component').then(
            (m) => m.InspeccionComponent,
          ),
      },
      {
        path: 'inspeccion/:visitaId',
        title: 'Inspección · EBA Aves',
        canActivate: [rolGuard],
        data: { roles: ['INSPECTOR', 'ADMINISTRADOR'] },
        loadComponent: () =>
          import('./pages/inspeccion/inspeccion.component').then(
            (m) => m.InspeccionComponent,
          ),
      },
      {
        path: 'administracion/usuarios',
        title: 'Usuarios y roles · EBA Aves',
        canActivate: [rolGuard],
        data: { roles: ['ADMINISTRADOR'] },
        loadComponent: () =>
          import('./pages/usuarios/usuarios.component').then(
            (m) => m.UsuariosComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'panel' },
];
