import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvisoComponent } from './aviso.component';

describe('AvisoComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvisoComponent],
    }).compileComponents();
  });

  /** Crea el componente con un tono dado. */
  function crear(tipo: string): ComponentFixture<AvisoComponent> {
    const fixture = TestBed.createComponent(AvisoComponent);
    fixture.componentRef.setInput('tipo', tipo);
    fixture.detectChanges();
    return fixture;
  }

  /** Caja interior del aviso (la que lleva los colores). */
  function caja(fixture: ComponentFixture<AvisoComponent>): HTMLElement {
    return fixture.nativeElement.querySelector('div') as HTMLElement;
  }

  it('usa los tokens del tono informativo', () => {
    const contenedor = caja(crear('info'));

    expect(contenedor.classList).toContain('bg-info-suave');
    expect(contenedor.classList).toContain('border-marca-suave');
  });

  it('marca el error como alerta y los demás como estado', () => {
    const peligro = caja(crear('peligro'));
    expect(peligro.classList).toContain('bg-peligro-suave');
    expect(peligro.getAttribute('role')).toBe('alert');

    expect(caja(crear('exito')).getAttribute('role')).toBe('status');
  });

  it('dibuja el icono del tono y permite reemplazarlo', () => {
    const fixture = crear('advertencia');
    const icono = (): HTMLElement =>
      fixture.nativeElement.querySelector('mat-icon') as HTMLElement;

    expect(icono().textContent).toContain('warning');

    fixture.componentRef.setInput('icono', 'cloud_off');
    fixture.detectChanges();
    expect(icono().textContent).toContain('cloud_off');
  });

  it('muestra el título solo cuando se indica', () => {
    const fixture = crear('info');
    expect(fixture.nativeElement.querySelector('p')).toBeNull();

    fixture.componentRef.setInput('titulo', 'Sin conexión');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('p') as HTMLElement).textContent,
    ).toContain('Sin conexión');
  });
});
