import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraficaComponent } from './grafica.component';

/**
 * Gráfica de una serie (RF10). Sin datos no dibuja un lienzo vacío: muestra una
 * explicación, para que un cero no se lea como un resultado.
 */
describe('GraficaComponent', () => {
  let fixture: ComponentFixture<GraficaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraficaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GraficaComponent);
  });

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('dibuja la gráfica cuando hay valores', () => {
    fixture.componentRef.setInput('tipo', 'linea');
    fixture.componentRef.setInput('etiquetas', ['May', 'Jun']);
    fixture.componentRef.setInput('valores', [78, 81]);
    fixture.detectChanges();

    expect(fixture.componentInstance.hayDatos()).toBe(true);
    const lienzo = (fixture.nativeElement as HTMLElement).querySelector(
      'canvas',
    );
    expect(lienzo).not.toBeNull();
  });

  it('ignora los meses sin resultado para decidir si hay datos', () => {
    fixture.componentRef.setInput('etiquetas', ['May', 'Jun']);
    fixture.componentRef.setInput('valores', [null, null]);
    fixture.detectChanges();

    expect(fixture.componentInstance.hayDatos()).toBe(false);
    expect(texto()).toContain('Sin datos todavía');
  });

  it('explica por qué está vacía', () => {
    fixture.componentRef.setInput('valores', []);
    fixture.componentRef.setInput(
      'vacio',
      'Los promedios se calculan con las mediciones (M3 a M6).',
    );
    fixture.detectChanges();

    expect(texto()).toContain(
      'Los promedios se calculan con las mediciones (M3 a M6).',
    );
  });

  it('dibuja una dona con los colores de cada categoría', () => {
    fixture.componentRef.setInput('tipo', 'dona');
    fixture.componentRef.setInput('etiquetas', ['Excelente', 'Bajo']);
    fixture.componentRef.setInput('valores', [4, 2]);
    fixture.componentRef.setInput('colores', ['nivel-excelente', 'nivel-bajo']);
    fixture.componentRef.setInput('textoCentro', '6');
    fixture.detectChanges();

    expect(texto()).toContain('6');
  });
});
