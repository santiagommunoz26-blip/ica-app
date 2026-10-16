import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EncabezadoPaginaComponent } from './encabezado-pagina.component';
import { TarjetaComponent } from '../tarjeta/tarjeta.component';
import { EstadoVacioComponent } from '../estado-vacio/estado-vacio.component';

/** Componente anfitrión: comprueba la proyección de contenido. */
@Component({
  standalone: true,
  imports: [EncabezadoPaginaComponent, TarjetaComponent, EstadoVacioComponent],
  template: `
    <app-encabezado-pagina titulo="Visitas" descripcion="Programe una visita.">
      <button type="button" class="accion">Nueva visita</button>
    </app-encabezado-pagina>

    <app-tarjeta titulo="Resumen" descripcion="Del mes">
      <p class="contenido">Cuerpo</p>
      <button acciones type="button" class="accion-tarjeta">Exportar</button>
    </app-tarjeta>

    <app-estado-vacio titulo="Sin visitas" descripcion="Cree la primera." />
  `,
})
class AnfitrionComponent {}

describe('EncabezadoPaginaComponent, TarjetaComponent y EstadoVacioComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnfitrionComponent],
    }).compileComponents();
  });

  it('el encabezado muestra título, descripción y las acciones proyectadas', () => {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();

    const encabezado = fixture.nativeElement.querySelector(
      'app-encabezado-pagina',
    ) as HTMLElement;
    expect(encabezado.querySelector('h1')?.textContent).toContain('Visitas');
    expect(encabezado.textContent).toContain('Programe una visita.');
    expect(encabezado.querySelector('.accion')).not.toBeNull();
    expect(encabezado.querySelector('h1')?.classList).toContain(
      'text-contenido',
    );
  });

  it('la tarjeta separa cabecera, acciones y contenido', () => {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();

    const tarjeta = fixture.nativeElement.querySelector(
      'app-tarjeta',
    ) as HTMLElement;
    expect(tarjeta.querySelector('h2')?.textContent).toContain('Resumen');
    expect(tarjeta.querySelector('.accion-tarjeta')).not.toBeNull();
    expect(tarjeta.querySelector('.contenido')?.textContent).toContain(
      'Cuerpo',
    );
  });

  it('el estado vacío explica la situación', () => {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();

    const vacio = fixture.nativeElement.querySelector(
      'app-estado-vacio',
    ) as HTMLElement;
    expect(vacio.textContent).toContain('Sin visitas');
    expect(vacio.textContent).toContain('Cree la primera.');
    expect(vacio.querySelector('mat-icon')).not.toBeNull();
  });
});
