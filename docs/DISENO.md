# Base de diseño — Aplicativo EBA Aves

Documento de referencia de la interfaz. Fija **una sola línea gráfica** para los
módulos M2–M8 (RNF14) a partir de los wireframes oficiales, y explica dónde
vive cada valor para que cambiar la marca no obligue a tocar componentes.

- Alcance: tema de Angular Material 18, tokens de diseño, componentes
  compartidos, estados de carga/error/vacío y accesibilidad.
- Fuera de alcance: rediseño de las pantallas de M1, pantallas nuevas y pulido
  visual fino (se hará en una sola pasada al final).
- Referencia visual obligatoria: `docs/Aplicativo EBA Aves – Wireframes.pdf`.

---

## 1. Dónde vive cada cosa

| Archivo | Qué contiene |
| --- | --- |
| `frontend/src/theme/_tokens.scss` | **Única fuente de verdad**: escalas de color, medidas, tipografía, sombras y su publicación como variables CSS (`:root`). |
| `frontend/src/theme/_material.scss` | Traduce los tokens a un tema propio de Angular Material (`mat.define-theme`, `mat.all-component-themes`) y ajusta formas y superficies de los componentes. |
| `frontend/src/styles.scss` | Orden de carga (Material → Tailwind → base), arreglos de interoperabilidad y las pocas clases globales (botón de acento, tonos de las notificaciones). |
| `frontend/tailwind.config.js` | Nombres semánticos de Tailwind que apuntan a las variables CSS (`marca`, `acento`, `exito`, `nivel-*`, `contenido`, …). |
| `frontend/src/app/shared/ui/` | Componentes compartidos (ver catálogo en la sección 5). |

**El tema prebuilt `azure-blue` ya no se usa.** El tema propio se aplica en
`styles.scss`:

```scss
@use '@angular/material' as mat;
@use './theme/tokens';
@use './theme/material' as tema-material;

@include mat.core();

html {
  @include tema-material.aplicar-tema();
}
@include tema-material.ajustar-componentes();

@tailwind base;
@tailwind components;
@tailwind utilities;
```

El tema de Material va **antes** de Tailwind para conservar el orden de cascada
que ya existía; Tailwind sigue pudiendo ajustar un componente desde la plantilla.

### Cómo cambiar la marca

Se cambia **solo** `frontend/src/theme/_tokens.scss` (la escala de color y, si
aplica, los radios). El tema de Material, los nombres de Tailwind y todos los
componentes se actualizan solos: no hay ningún color de marca escrito en los
componentes.

---

## 2. Color

La paleta se obtuvo muestreando los wireframes y se confirmó con el equipo:

- **Primario** — verde esmeralda oscuro `#10392A`.
- **Acento** — lima `#E8F06B` (realces y acciones destacadas).
- **Fondo** — crema `#F4F2E8`; tarjetas en `#FFFEFB`.
- **Aviso** — coral `#E18D5B` (inactivo, nivel bajo, pendientes).
- **Texto** — verde-gris oscuro `#1B2A22`.

### 2.1 Tokens semánticos

| Variable CSS | Valor | Uso |
| --- | --- | --- |
| `--color-marca` | `#10392A` | Color primario: botones principales, píldora de navegación activa, títulos de marca. |
| `--color-marca-fuerte` | `#0D3424` | Estados *hover*/presionado del primario. |
| `--color-marca-media` | `#2F7D4F` | Verde medio: insignias e iconos de confirmación. |
| `--color-marca-suave` | `#C7E3CE` | Fondo de énfasis suave (círculos de iconos, avatares). |
| `--color-marca-tenue` | `#E3F1E6` | Fondo tenue (avisos informativos). |
| `--color-sobre-marca` | `#FFFFFF` | Texto e iconos **sobre** el color de marca. |
| `--color-acento` | `#E8F06B` | Realce de marca (p. ej. acción secundaria destacada). |
| `--color-acento-fuerte` | `#B5BD0F` | Estados *hover* del acento. |
| `--color-acento-suave` | `#F2F7AE` | Fondo de realce claro. |
| `--color-sobre-acento` | `#1E2100` | Texto **sobre** el acento (oscuro, por contraste). |
| `--color-fondo` | `#F4F2E8` | Fondo general de la aplicación. |
| `--color-superficie` | `#FFFEFB` | Tarjetas, tablas, menús, diálogos. |
| `--color-superficie-alterna` | `#EFECDF` | Cajas de realce y encabezados de tabla. |
| `--color-velo` | `rgba(16,57,42,.4)` | Fondo oscurecido tras paneles y diálogos. |
| `--color-borde` | `#DCDCD3` | Bordes de tarjetas, tablas y divisiones. |
| `--color-borde-fuerte` | `#BCC3BB` | Bordes de campos activos. |
| `--color-texto` | `#1B2A22` | Texto principal. |
| `--color-texto-suave` | `#57685C` | Texto secundario y de apoyo. |
| `--color-texto-deshabilitado` | `#9AA79D` | Texto deshabilitado. |
| `--color-exito` | `#2F7D4F` | Estado correcto / activo. |
| `--color-exito-suave` | `#DCECDF` | Fondo de aviso de éxito. |
| `--color-info` | `#10392A` | Aviso informativo (verde de marca sobre crema). |
| `--color-info-suave` | `#E3F1E6` | Fondo del aviso informativo. |
| `--color-advertencia` | `#E18D5B` | Advertencia / inactivo / nivel bajo. |
| `--color-advertencia-suave` | `#F9E6D8` | Fondo de advertencia. |
| `--color-advertencia-texto` | `#8A4A1B` | Texto de advertencia sobre fondo claro (contraste ≥ 4.5:1). |
| `--color-peligro` | `#B3261E` | Error. |
| `--color-peligro-suave` | `#F7DCD8` | Fondo del aviso de error. |
| `--color-nivel-excelente` | `#10392A` | Clasificación ≥ 90. |
| `--color-nivel-alto` | `#2F7D4F` | Clasificación ≥ 75 y < 90. |
| `--color-nivel-medio` | `#E8F06B` | Clasificación ≥ 50 y < 75. |
| `--color-nivel-bajo` | `#E18D5B` | Clasificación < 50. |

Cada color tiene su `--color-sobre-*` (texto encima) y su par de nivel
`--color-sobre-nivel-*`, para que las gráficas y tablas del M7 pinten texto
legible sobre cualquier relleno.

### 2.2 Escalas tonales

El tema de Material necesita escalas completas (tonos 0–100), no colores
sueltos. `_tokens.scss` define `$marca-*` y `$acento-*`; el tono 40 es el color
primario y el tono 90 el contenedor claro. `_material.scss` sólo reemplaza esos
tonos en las paletas de Material (heredando de `$green-palette` y
`$chartreuse-palette` los neutros y el error), de modo que el tema generado es
coherente y no hay valores inventados fuera de los tokens.

### 2.3 Nombres en Tailwind

| Token | Clases |
| --- | --- |
| `marca` | `bg-marca`, `text-marca`, `border-marca-suave`, `text-marca-contraste`… |
| `acento` | `bg-acento`, `text-acento-contraste`… |
| `superficie` | `bg-superficie`, `bg-superficie-alterna` |
| `fondo` / `velo` | `bg-fondo`, `bg-velo` |
| `borde` | `border-borde`, `border-borde-fuerte` |
| `contenido` | `text-contenido`, `text-contenido-suave`, `text-contenido-deshabilitado` |
| `exito` / `info` / `advertencia` / `peligro` | `bg-exito-suave`, `text-peligro`, `text-advertencia-texto`… |
| `nivel` | `bg-nivel-excelente`, `bg-nivel-alto`, `bg-nivel-medio`, `bg-nivel-bajo` |

Los colores son variables CSS, así que **los modificadores de opacidad de
Tailwind (`bg-marca/40`) no funcionan**: para eso están los tonos `-suave`,
`-tenue` y `-velo`.

---

## 3. Tipografía, medidas y elevación

- **Familia única:** Roboto (`--fuente-base`), con respaldo en `Helvetica Neue`,
  Arial, `sans-serif`. Se usa para todo: títulos, cuerpo y etiquetas.
- **Escala:** `--texto-xs` 12 px, `-sm` 14, `-base` 16, `-lg` 18, `-xl` 20,
  `-2xl` 24, `-3xl` 30. Coincide con la escala de Tailwind (`text-xs` …
  `text-3xl`), así que no hay dos escalas en juego.
- **Pesos:** 400 texto, 500 énfasis y títulos de tarjeta, 700 títulos de página.
- **Radios:** `xs` 6, `sm` 10, `md` 12 (campos), `lg` 20 (tarjetas), `xl` 28,
  `full` (insignias y botones). Clases: `rounded-md`, `rounded-tarjeta`,
  `rounded-full`.
- **Sombras:** `--sombra-1/2/3` (clases `shadow-suave`, `shadow-media`,
  `shadow-alta`) y `--sombra-foco` para el foco.
- **Espaciado:** `--espacio-xs` 8 px, `-sm` 12, `-md` 16, `-lg` 24, `-xl` 32,
  `-2xl` 48; también como clases (`p-md`, `gap-lg`, `px-xl`).
- **Área táctil:** `--altura-control` 44 px (`min-h-control`). Los botones de
  Material se ajustan a esa altura para poder usarlos en campo con una mano
  (RNF12).
- **Ancho de contenido:** `--ancho-contenido` 72 rem (`max-w-contenido`).

---

## 4. Accesibilidad (RNF13, RNF15, RNF16)

- **Foco visible** en todo el producto: `:focus-visible` con contorno de marca y
  `--sombra-foco` en los controles.
- **Contraste:** texto blanco sobre `#10392A` (≈ 13:1) y sobre `#2F7D4F`
  (≈ 4.7:1); sobre el acento y el coral se usa texto oscuro (`#1E2100`,
  `#1B2A22`) porque el blanco no alcanzaría 4.5:1.
- **Sin depender sólo del color:** las insignias llevan texto y las acciones
  destructivas van en rojo **y** con confirmación.
- **Anuncios:** los avisos se exponen con `role="status"` y los errores con
  `role="alert"`; los esqueletos con `aria-busy="true"` y texto para lectores de
  pantalla; las notificaciones usan el `aria-live` de `MatSnackBar`.
- **Movimiento:** las animaciones de carga se desactivan con
  `prefers-reduced-motion`.
- **Responsive:** las pantallas se construyen con `flex`/`grid` y puntos de
  corte de Tailwind; botones y controles mantienen 44 px de alto.
- **Navegadores objetivo (RNF16):** Chrome/Edge y Firefox actuales.

---

## 5. Catálogo de componentes

Todos están en `frontend/src/app/shared/ui/`, son `standalone`, se importan
por separado y usan sólo tokens. Nombres y textos en español.

### `app-aviso` — banda de aviso

Mensajes dentro de una pantalla. Cuatro tonos: `info`, `exito`, `advertencia`,
`peligro`. El error se anuncia como alerta; el resto, como estado.

```html
<app-aviso tipo="advertencia">
  Está trabajando sin conexión. Los cambios se sincronizarán al volver la red.
</app-aviso>

<app-aviso tipo="peligro" titulo="No se pudo guardar">{{ mensaje }}</app-aviso>
```

### `app-insignia` — etiqueta de estado

Píldora corta. Tonos: `neutro`, `marca`, `acento`, `exito`, `advertencia`,
`peligro` y los de clasificación `excelente`, `alto`, `medio`, `bajo`.

```html
<app-insignia [tono]="usuario.estado === 'ACTIVO' ? 'exito' : 'neutro'">
  {{ usuario.estado === 'ACTIVO' ? 'Activo' : 'Inactivo' }}
</app-insignia>

<app-insignia tono="alto" icono="trending_up">Alto</app-insignia>
```

### `app-encabezado-pagina` — encabezado de pantalla

Título, descripción y acciones proyectadas a la derecha.

```html
<app-encabezado-pagina titulo="Visitas" descripcion="Programe y siga sus visitas.">
  <button mat-flat-button color="primary" type="button">
    <mat-icon>add</mat-icon> Nueva visita
  </button>
</app-encabezado-pagina>
```

### `app-tarjeta` — tarjeta o sección

Contenedor estándar. `variante`: `superficie` (por defecto), `realce`, `marca`.
`relleno`: `normal`, `compacto`, `ninguno`. Las acciones se proyectan con el
atributo `acciones`.

```html
<app-tarjeta titulo="Resumen" descripcion="Del mes en curso">
  <button acciones mat-stroked-button type="button">Exportar</button>
  <p>Contenido de la sección…</p>
</app-tarjeta>
```

### `app-estado-vacio` — sin datos

Explica por qué no hay datos y ofrece la acción siguiente.

```html
<app-estado-vacio
  icono="person_search"
  titulo="No hay usuarios que coincidan con la búsqueda"
  descripcion="Pruebe con otro nombre, correo o rol."
/>
```

### `app-esqueleto` — estado de carga

Ocupa el lugar del contenido mientras llegan los datos (evita que la pantalla
«salte», RNF05). `forma`: `lineas`, `tarjeta`, `tabla`.

```html
@if (cargando()) {
  <app-esqueleto forma="tabla" [filas]="5" />
} @else {
  <!-- tabla real -->
}
```

### Botones (convención)

No hay componente envoltorio: se usan los botones de Angular Material, que ya
respetan los tokens del tema. La nomenclatura es fija:

| Acción | Cómo se escribe |
| --- | --- |
| Principal de la pantalla | `<button mat-flat-button color="primary">` |
| Secundaria | `<button mat-stroked-button>` |
| Terciaria o de descarte | `<button mat-button>` |
| Destructiva | `<button mat-flat-button color="warn">` + confirmación |
| Realce de marca (lima) | `<button mat-flat-button class="boton-acento">` |
| Sólo icono | `<button mat-icon-button aria-label="…">` |

### `ConfirmacionService` — diálogo de confirmación

```ts
if (await this.confirmacion.confirmar({
  titulo: 'Inactivar usuario',
  mensaje: 'No podrá ingresar mientras esté inactivo.',
  textoConfirmar: 'Inactivar',
  peligroso: true,
})) {
  // continuar
}
```

### `NotificacionService` — notificaciones flotantes

```ts
this.notificaciones.exito('Usuario creado.');
this.notificaciones.error('No se pudo guardar el cambio.');
```

---

## 6. Estados de la interfaz

Toda pantalla con datos remotos debe cubrir los cuatro estados:

1. **Carga:** `app-esqueleto` (o `mat-progress-bar` si sólo se refresca).
2. **Error:** `app-aviso tipo="peligro"` con el mensaje de
   `core/http/errores.ts`, más un botón para reintentar cuando aplique.
3. **Vacío:** `app-estado-vacio` con la acción siguiente.
4. **Con datos:** el contenido.

Los avisos de éxito se confirman con `NotificacionService` (no con avisos
dentro de la pantalla) para no dejar mensajes pegados al formulario.

---

## 7. Decisiones

1. **Un solo tema, definido en código.** Se elimina el prebuilt `azure-blue` de
   `angular.json` y se genera el tema con `mat.define-theme` +
   `mat.all-component-themes`, para que el color de la marca y el color de
   Material sean el mismo valor.
2. **Los tokens viven en un archivo SCSS y se publican como variables CSS.**
   Tailwind los consume con `var(--…)`, así que hay una sola fuente y los colores
   se pueden inspeccionar en el navegador.
3. **Campos de formulario con radio de 12 px.** En los wireframes los campos de
   una línea son tipo píldora; se optó por un radio generoso para que los campos
   multilínea («Observaciones», muy usados en la inspección) no queden deformes.
   Pasar a píldora es cambiar `--mdc-outlined-text-field-container-shape`.
4. **La navegación activa es una píldora oscura** (como el wireframe). Como el
   texto y el icono de un `mat-list-item` se pintan con variables propias de
   Material, el armazón las reasigna a los tokens en `shell.component.scss`
   (`.nav-activo`).
5. **Sin componente envoltorio de botones.** Se documenta la convención y se usa
   Material directamente: se conserva el *ripple*, el foco y la accesibilidad
   nativa sin duplicar código.
6. **El aviso informativo usa el verde de marca sobre crema** (como el
   wireframe), no un azul de sistema: la paleta no tiene azul.
7. **El acento lima no se usa como color de texto ni como fondo de texto
   blanco** por contraste; aparece como relleno con texto oscuro.
8. **Se ajustan formas y superficies de Material** en
   `_material.scss#ajustar-componentes` (tarjetas de 20 px, menús, diálogos,
   panel lateral y barra en la superficie clara, contenido sobre el fondo crema)
   y la altura de los botones a 44 px.

## 8. Observaciones para la pasada de pulido final

Detectadas al revisar las capturas; **no** se corrigen aquí porque el pulido
fino se hará en una sola pasada:

- En las pantallas de M1, el espacio entre un párrafo y el primer campo de un
  formulario es corto: la etiqueta flotante (que sobresale del campo) queda muy
  cerca del texto anterior.
- En el buscador de usuarios (campo con icono de prefijo) la etiqueta se separa
  un poco del contorno.
- Los elementos de «Próximos módulos» del panel lateral muestran la etiqueta del
  módulo (M5, M6…) desalineada de la columna de texto.
