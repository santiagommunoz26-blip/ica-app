import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmacionService } from './confirmacion.service';
import { DialogoConfirmacionComponent } from './dialogo-confirmacion.component';

describe('ConfirmacionService', () => {
  let servicio: ConfirmacionService;
  let dialogos: MatDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideNoopAnimations()] });
    servicio = TestBed.inject(ConfirmacionService);
    dialogos = TestBed.inject(MatDialog);
  });

  it('abre el diálogo compartido con los datos recibidos', async () => {
    const promesa = servicio.confirmar({
      titulo: 'Inactivar usuario',
      mensaje: 'No podrá ingresar mientras esté inactivo.',
      textoConfirmar: 'Inactivar',
      peligroso: true,
    });

    const abierto = dialogos.openDialogs[0];
    expect(
      abierto.componentInstance instanceof DialogoConfirmacionComponent,
    ).toBeTrue();
    expect(abierto.componentInstance['datos'].titulo).toBe('Inactivar usuario');

    abierto.close(false);
    await expectAsync(promesa).toBeResolvedTo(false);
  });

  it('devuelve verdadero solo si se confirma', async () => {
    const promesa = servicio.confirmar({
      titulo: 'Cerrar visita',
      mensaje: 'La visita quedará cerrada.',
    });

    dialogos.openDialogs[0].close(true);
    await expectAsync(promesa).toBeResolvedTo(true);
  });
});
