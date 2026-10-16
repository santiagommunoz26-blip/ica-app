import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InsigniaComponent } from './insignia.component';

describe('InsigniaComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsigniaComponent],
    }).compileComponents();
  });

  /** Crea la insignia con un tono dado. */
  function crear(tono?: string): ComponentFixture<InsigniaComponent> {
    const fixture = TestBed.createComponent(InsigniaComponent);
    if (tono) {
      fixture.componentRef.setInput('tono', tono);
    }
    fixture.detectChanges();
    return fixture;
  }

  /** Píldora interior (la que lleva los colores). */
  function pildora(fixture: ComponentFixture<InsigniaComponent>): HTMLElement {
    return fixture.nativeElement.querySelector('span') as HTMLElement;
  }

  it('usa los tokens del estado (éxito y advertencia)', () => {
    const exito = pildora(crear('exito'));
    expect(exito.classList).toContain('bg-exito');
    expect(exito.classList).toContain('text-exito-contraste');

    expect(pildora(crear('advertencia')).classList).toContain('bg-advertencia');
  });

  it('usa los colores de la clasificación del bienestar', () => {
    expect(pildora(crear('excelente')).classList).toContain(
      'bg-nivel-excelente',
    );
    expect(pildora(crear('bajo')).classList).toContain('bg-nivel-bajo');
  });

  it('el tono por defecto es neutro y el icono es opcional', () => {
    const fixture = crear();

    expect(pildora(fixture).classList).toContain('bg-superficie-alterna');
    expect(fixture.nativeElement.querySelector('mat-icon')).toBeNull();
  });
});
