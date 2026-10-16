import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificacionService } from './notificacion.service';

describe('NotificacionService', () => {
  let servicio: NotificacionService;
  let snackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(() => {
    snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: snackBar }],
    });
    servicio = TestBed.inject(NotificacionService);
  });

  it('aplica el tono de éxito con su clase de tokens', () => {
    servicio.exito('Usuario creado.');

    expect(snackBar.open).toHaveBeenCalledWith(
      'Usuario creado.',
      'Cerrar',
      jasmine.objectContaining({ panelClass: 'aviso-snack-exito' }),
    );
  });

  it('un error dura más tiempo y se anuncia como peligro', () => {
    servicio.error('No se pudo guardar.');

    const [, , opciones] = snackBar.open.calls.mostRecent().args;
    expect((opciones as { panelClass: string }).panelClass).toBe(
      'aviso-snack-peligro',
    );
    expect((opciones as { duration: number }).duration).toBeGreaterThan(4000);
  });

  it('también ofrece avisos informativos y de advertencia', () => {
    servicio.info('Sincronizando…');
    expect(
      (snackBar.open.calls.mostRecent().args[2] as { panelClass: string })
        .panelClass,
    ).toBe('aviso-snack-info');

    servicio.advertencia('Revise la conexión.');
    expect(
      (snackBar.open.calls.mostRecent().args[2] as { panelClass: string })
        .panelClass,
    ).toBe('aviso-snack-advertencia');
  });
});
