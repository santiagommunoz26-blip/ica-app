import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

/** Página inicial del aplicativo (S0-5). */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatToolbarModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly titulo = 'Hola ICA';
  readonly descripcion =
    'Aplicativo para evaluar el bienestar animal en aves con la metodología ICA v2.0 (2024).';
  readonly etapa = 'Sprint 0 · base del proyecto';
  readonly stack = 'Angular 18 · Angular Material · Tailwind CSS';
}
