import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EsqueletoComponent } from './esqueleto.component';

describe('EsqueletoComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EsqueletoComponent],
    }).compileComponents();
  });

  /** Crea el esqueleto con una forma y un número de filas. */
  function crear(
    forma: string,
    filas: number,
  ): ComponentFixture<EsqueletoComponent> {
    const fixture = TestBed.createComponent(EsqueletoComponent);
    fixture.componentRef.setInput('forma', forma);
    fixture.componentRef.setInput('filas', filas);
    fixture.detectChanges();
    return fixture;
  }

  it('anuncia que está cargando de forma accesible', () => {
    const fixture = crear('lineas', 3);
    const contenedor = fixture.nativeElement.querySelector(
      '[role="status"]',
    ) as HTMLElement;

    expect(contenedor.getAttribute('aria-busy')).toBe('true');
    expect(
      (fixture.nativeElement.querySelector('.sr-only') as HTMLElement)
        .textContent,
    ).toContain('Cargando');
  });

  it('respeta el número de líneas pedido', () => {
    const fixture = crear('lineas', 4);
    expect(fixture.nativeElement.querySelectorAll('.esqueleto').length).toBe(4);
  });

  it('en forma de tabla dibuja una cabecera más las filas', () => {
    const fixture = crear('tabla', 3);
    expect(fixture.nativeElement.querySelectorAll('.esqueleto').length).toBe(4);
  });
});
