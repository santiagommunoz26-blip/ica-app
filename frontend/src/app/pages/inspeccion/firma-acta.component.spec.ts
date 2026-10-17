import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FirmaActaComponent } from './firma-acta.component';

/** Evento de puntero simulado, con la posición sobre el lienzo. */
function puntero(x: number, y: number): PointerEvent {
  return {
    offsetX: x,
    offsetY: y,
    pointerId: 1,
    currentTarget: null,
  } as unknown as PointerEvent;
}

/** Firma del acta en el diálogo (M7 · RF42). */
describe('FirmaActaComponent', () => {
  let fixture: ComponentFixture<FirmaActaComponent>;
  let componente: FirmaActaComponent;
  let cerrado: jasmine.Spy;

  async function configurar(): Promise<void> {
    cerrado = jasmine.createSpy('close');

    await TestBed.configureTestingModule({
      imports: [FirmaActaComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: { close: cerrado } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FirmaActaComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('dibuja un trazo y devuelve la firma en PNG (RF42)', async () => {
    await configurar();

    componente.iniciar(puntero(10, 10));
    componente.mover(puntero(40, 30));
    componente.mover(puntero(80, 50));
    expect(componente.hayTrazo()).toBeTrue();

    componente.firmar();

    expect(cerrado).toHaveBeenCalledTimes(1);
    const firma = cerrado.calls.mostRecent().args[0] as string;
    expect(firma.startsWith('data:image/png;base64,')).toBeTrue();
  });

  it('no deja firmar sin trazo y lo explica', async () => {
    await configurar();

    componente.firmar();
    expect(cerrado).not.toHaveBeenCalled();
    expect(componente.error()).toContain('Dibuje su firma');

    // Un movimiento suelto, sin haber apoyado el dedo, no cuenta.
    componente.mover(puntero(20, 20));
    expect(componente.hayTrazo()).toBeFalse();
  });

  it('limpiar borra la firma y el error', async () => {
    await configurar();

    componente.firmar();
    componente.iniciar(puntero(5, 5));
    componente.mover(puntero(30, 30));
    expect(componente.hayTrazo()).toBeTrue();

    componente.limpiar();
    expect(componente.hayTrazo()).toBeFalse();
    expect(componente.error()).toBeNull();
  });

  it('cancelar cierra el diálogo sin firma', async () => {
    await configurar();

    componente.cancelar();
    expect(cerrado).toHaveBeenCalledWith();
  });
});
