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

### Utilidades de Tailwind frente a Material

Angular Material **inyecta los estilos de sus componentes en tiempo de
ejecución**, es decir, después de la hoja global. Por eso una utilidad de
Tailwind puesta sobre un elemento de Material (`mat-card-content`, `mat-card`,
…), con la misma especificidad y en una hoja anterior, **perdía** la cascada: el
relleno de 24 px de las tarjetas no se aplicaba y el bloque de contenido no era
un `flex`, con lo que los hijos se pegaban sin separación.

La solución es `important: true` en `frontend/tailwind.config.js`: las
utilidades se emiten con `!important` y **mandan sobre el relleno, el apilado y
el fondo que Material trae de fábrica**. Es la jerarquía que se quiere en este
producto (los tokens y las utilidades por encima del aspecto por defecto de la
biblioteca). Consecuencia a tener en cuenta: una utilidad también gana a un
estado propio de Material (por ejemplo el color de un botón deshabilitado), así
que no se debe poner una utilidad de color sobre un control cuyo estado se
quiera conservar.

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
- **Reserva de la etiqueta:** `--campo-reserva-etiqueta` 12 px. La etiqueta de un
  campo con contorno se apoya en el borde superior y sobresale la mitad de su
  alto; ese espacio se reserva por encima de cada campo (`.mat-mdc-form-field`)
  para que la etiqueta nunca pise el párrafo o el título que va antes.
- **Alto de la barra:** `--altura-barra` 64 px (`h-barra`). Es el alto de la barra
  superior y del bloque de marca del panel lateral, de modo que la división del
  panel coincide con el borde inferior de la barra. La barra no se encoge
  (`shrink-0`): su alto no depende del contenido de la pantalla.
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

### `app-grafica` — gráfica de una serie

Envoltorio de Chart.js para el panel (RF10). Los colores **no se escriben a
mano**: se piden con el nombre del token (`marca`, `acento`, `nivel-alto`…) y el
componente los resuelve leyendo las variables CSS del tema. Sin datos no dibuja
un lienzo vacío: muestra `app-estado-vacio` con la explicación de qué falta.

| Entrada | Uso |
| --- | --- |
| `tipo` | `linea`, `barras`, `dona` |
| `etiquetas`, `valores` | la serie (los huecos se escriben `null`) |
| `color` | token de la serie (`marca` por defecto) |
| `colores` | un token por categoría (solo dona) |
| `maximo` | tope del eje (100 en las calificaciones) |
| `textoCentro` | número que va en el hueco de la dona |
| `vacio` | frase que explica por qué todavía no hay datos |

```html
<app-grafica
  tipo="dona"
  [etiquetas]="etiquetasDistribucion()"
  [valores]="valoresDistribucion()"
  [colores]="coloresDistribucion()"
  [textoCentro]="textoTotalClasificado()"
  vacio="La distribución aparecerá cuando las visitas tengan resultado."
/>
```

### Pestañas de filtro (convención)

Para filtrar por estado se usan píldoras como en el wireframe: la activa va con
`bg-marca text-marca-contraste` y las demás con borde y `bg-superficie-alterna`.
Cada píldora lleva su conteo (`Todas 24`). No es una tabla de Material: es un
`<nav>` de botones, para que el conteo quede dentro de la píldora.

Las **pestañas de fase** de la inspección (Fase I · Apertura, II · Galpón,
III · Documental y IV · Cierre) usan la misma píldora; la fase que todavía no
existe se ve con borde, atenuada y con el módulo entre paréntesis (`(M4)`), y al
pulsarla no cambia de pestaña: muestra un aviso de que llega en ese módulo. Las
opciones de una sola elección que en el wireframe son tarjetas (el grupo
productivo) se escriben como botones con borde que se rellenan con
`bg-info-suave text-marca` al quedar elegidos, no como `mat-radio-button`.

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

### Armazón (`layout/shell`)

Convenciones propias del armazón, todas con tokens:

- **Barra superior:** alto `h-barra` (64 px) y `shrink-0`, para que su borde
  coincida con la división del panel lateral y no dependa de la altura del
  contenido.
- **Ficha del usuario:** círculo verde de marca con las iniciales en blanco
  (`bg-marca text-marca-contraste`) y, en pantallas anchas, el nombre; todo en
  una línea. El contenido proyectado de un botón de Material se envuelve en
  `.mdc-button__label`, que no es flexible: la clase `.boton-usuario`
  (`shell.component.scss`) lo convierte en fila centrada, porque un `flex`
  suelto dentro parte el botón en dos líneas.
- **Navegación:** la opción activa es la píldora verde oscura (`.nav-activo`) y
  los módulos que aún no existen van atenuados (`opacity-60`) y sin la capa de
  estado que Material pinta en un elemento de lista deshabilitado
  (`.item-pendiente`); el color de esos elementos vuelve a los tokens para que
  sigan legibles.

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
9. **Las utilidades de Tailwind se emiten con `!important`** (`important: true`)
   porque Material inyecta los estilos de sus componentes en tiempo de
   ejecución, después de la hoja global, y una utilidad sobre un elemento de
   Material perdía la cascada (el caso visible: el contenido de las tarjetas se
   apilaba sin separación y con 16 px de relleno en vez de los 24 px de los
   tokens). Ver «Utilidades de Tailwind frente a Material».
10. **Cada campo reserva el alto de su etiqueta** (12 px por encima, token
    `--campo-reserva-etiqueta`): la etiqueta del contorno se apoya en el borde y
    sobresale, así que sin esa reserva pisaba el texto anterior (se veía en el
    bloque «Acceso sin conexión (PIN)» del panel).
11. **El alto de la barra superior es un token** (`--altura-barra` 64 px) que
    también usa el bloque de marca del panel lateral, y la barra lleva
    `shrink-0`: sin eso la barra se encogía según el contenido de la pantalla y
    su borde no coincidía con la división del panel.
12. **La ficha del usuario y los módulos pendientes se ajustan en el armazón**
    (no con estilos sueltos por pantalla): la ficha es un círculo verde con las
    iniciales en blanco —como el wireframe— y una fila centrada; los módulos
    pendientes son `mat-list-item` deshabilitados (estructura de lista correcta,
    con el icono, el nombre y la etiqueta del módulo alineados) sin la capa de
    estado de Material.
13. **Las gráficas toman su color de los tokens** (`app-grafica` resuelve
    `--color-<token>` al dibujar): no hay ningún color de marca escrito a mano en
    un componente. Si un token no existe, el respaldo es un gris neutro
    (`rgba(0,0,0,.4)`), nunca el color de otro token «parecido».
14. **Fechas y números en español de Colombia** (`LOCALE_ID` `es-CO` con
    `registerLocaleData` en `app.config.ts`): meses, días y horas en `es-CO`. Los
    campos `input type="date"` nativos muestran el formato del idioma del
    navegador, no el de Angular; es una limitación del control, no un olvido.
15. **El presupuesto de advertencia del paquete inicial subió a 600 kB**
    (`angular.json`). El paquete se mide **sin comprimir** e incluye Angular
    Material completo; lo que descarga el usuario son ~130 kB. Con 500 kB la
    advertencia ya saltaba desde la base de diseño (por 12 kB) sin que hubiera
    nada que recortar.
16. **La pantalla de inspección reutiliza las convenciones en vez de inventar
    otras** (M3): las fases son píldoras con el módulo que las construirá, las
    tarjetas de opción son botones con borde, la clasificación automática se
    muestra en una tarjeta lateral con los pesos aplicados, y el catálogo
    provisional se anuncia con `app-aviso tipo="advertencia"`. Cuando todavía no
    se ha registrado el número de aves, la tarjeta de clasificación muestra el
    tipo declarado al programar la visita y lo dice, en vez de quedar vacía.
17. **La Fase II es un componente aparte de la ficha** (`fase2-galpon`), con la
    disposición del wireframe en tres columnas: indicadores con su avance a la
    izquierda, el indicador activo con sus puntos de muestreo en el centro y el
    cálculo en vivo con el avance del galpón a la derecha. La página solo le
    pasa la respuesta de la API y le pide guardar o recargar.
18. **El borrador de la Fase II viaja por la misma cola de M2** (RF12) como una
    operación `GUARDAR_INSPECCION` más; si ya hay un borrador pendiente de la
    misma visita, se funde con él (el último gana campo a campo y las
    evaluaciones se mezclan por galpón e indicador) para que la copia local no
    acumule una ficha completa por cada guardado.
19. **Las evaluaciones se guardan semi-estructuradas en JSONB** (ADR-001) y las
    reglas viven dos veces: en el servidor (`fase2.reglas.ts`, que manda) y
    espejadas en el frontend (`fase2.modelos.ts`, para poder diligenciar y
    calcular sin conexión). El servidor rechaza lo imposible —puntajes fuera de
    0–2, muestras fuera de rango o jaulas calificadas sin conteo previo— y el
    espejo muestra el mismo mensaje antes de guardar.
20. **Guardar un borrador no exige el indicador completo** (RF26): lo
    incompleto se muestra («Faltan 5 de 9 puntos») y la completitud es
    informativa (marca ✓ en la lista y avance por grupo). «No aplica» exige
    motivo, vacía los puntos y sale del cálculo (RF25).
21. **En jaula no se califica antes de contar** (RF21): los botones 0/1/2 del
    punto quedan deshabilitados con su explicación hasta que tenga jaulas (3–5)
    y aves (10–20); en piso basta el puntaje. Las hojas centinela (MBR-01) se
    agregan de a una y una hoja agregada y vacía deja el indicador incompleto,
    igual que los 9 puntos fijos.
22. **El cálculo en vivo adelanta solo la parte visible de M6** (RF34): valor
    del indicador = promedio × 100 / 2, con la operación a la vista como en el
    wireframe. El cálculo de grupos, la clasificación final y su persistencia
    siguen en M6. Pregunta y descripciones de la escala salen del catálogo
    (`pregunta`, `escala_descripciones`); solo se sembró lo que el wireframe
    muestra (la calidad de la cama).
23. **Las fotos se suben directo al almacenamiento con URL firmada**
    (ADR-003, RF23): el binario no pasa por la API; en la base solo quedan
    metadatos (nombre, tipo, tamaño, hash) y el estado de confirmación. En
    pantalla se admiten fotos JPG/PNG/WebP hasta 8 MB; sin conexión el botón se
    bloquea y avisa que se suben al volver la red (los videos y documentos
    quedan pendientes de definir su tamaño).
24. **Fidelidad al wireframe en las pestañas de fase (RNF14):** son cuatro
    píldoras iguales («I · Apertura», «II · Inspección galpón», «III ·
    Documental», «IV · Cierre»), sin la palabra «Fase» delante. La activa va en
    verde oscuro; la completada, en lima con visto bueno; las disponibles, en
    blanco con borde; las que todavía no se construyen, en gris con su módulo.
    Se considera completa la Fase I cuando la ficha ya se guardó y la Fase II
    cuando todos los indicadores de los galpones marcados quedaron completos o
    con «No aplica» (RF24).
25. **La Fase II sigue el wireframe de la inspección en galpón:** la tarjeta
    izquierda muestra **solo el grupo del indicador activo** («Indicadores
    MBR») con su avance («3 de 9 completos» y barra); el centro lleva el título,
    la píldora «MBR · visual con muestreo», la pregunta, los puntos como
    círculos (lima = calificado, verde oscuro = seleccionado, blanco = pendiente),
    las tres tarjetas de puntaje (2, 1 y 0, con la descripción de la escala) y la
    píldora «Adjuntar foto · Observación…»; el panel derecho va oscuro, con
    «Cálculo en vivo», los puntos registrados, el promedio, la operación a la
    vista, el valor del indicador, la barra y la píldora «Faltan 5 de 9 puntos».
26. **Los añadidos de la Fase II que el wireframe no muestra se conservan** (para
    no perder requisitos) con la desviación mínima: los campos de aves y jaulas
    del punto seleccionado van bajo los círculos; «No aplica» con su motivo,
    discreto sobre los puntos; «Guardar borrador» como botón de texto entre
    «Anterior» y «Guardar y siguiente»; y el selector de galpón, arriba,
    restilizado como píldoras. Se le avisó al usuario al entregar.
27. **Orden de la fase: MBR y luego MBA** (como el wireframe, que lista MBR
    primero y muestra «MBR 3/9 · MBA 0/10»). «Anterior/Siguiente» recorren los
    indicadores en ese orden y el avance del panel derecho pone primero el grupo
    activo. Los puntos de muestreo recuerdan el que se está calificando y los
    puntajes se aplican al punto seleccionado.
28. **Tono intermedio de la marca** (`--color-marca-intermedia`, tono 50) para
    las cajas sobre los paneles oscuros del wireframe: chips de puntos
    pendientes, píldora «Faltan…», pista de las barras y separadores del panel
    derecho. Los tonos que ya existían no servían (el 30 no se distingue del
    fondo y el 60 contrasta demasiado).
29. **La pantalla de inspección no lleva encabezado grande** (el wireframe pasa
    de las pestañas al contenido): en su lugar va una línea de contexto con el
    predio y la fase, más el enlace «Otras visitas». La Fase I también se alineó
    al wireframe: tarjeta blanca de ficha, botones de grupo productivo en
    píldoras, filas de galpón redondeadas con el círculo que marca si se
    inspecciona, y panel oscuro de clasificación con los pesos y los galpones a
    inspeccionar.
30. **La Fase III es un componente aparte** (`fase3-documental`), con la
    disposición del wireframe en dos columnas: a la izquierda la lista de
    documentos de gestión (MBG) con su avance («4 de 10 verificados» y barra); al
    centro el documento activo con «¿Se presentó el documento?», «Condiciones del
    documento», las tarjetas de puntaje y la banda «Si no se presenta, el
    indicador se califica con 0 puntos.». No lleva panel derecho: el wireframe
    no lo trae.
31. **Un documento por indicador MBG, sin tablas nuevas** (ADR-001): la
    verificación se guarda en `respuestas.fase3.documentos` (JSONB) y la lista
    sale del catálogo. La Fase III no tiene observaciones ni fotos porque el
    wireframe no las muestra. Las insignias de la lista son las del wireframe:
    «Revisando» (activo, lima), «Pendiente» (coral), «N pts» (lima el 2, verde
    el 1, rojo el 0) y «Sin ver» (gris).
32. **El puntaje de la Fase III sale de la regla, no del criterio del inspector
    en los dos casos automáticos:** si el documento no se presentó, es 0 (RF29);
    si es el documento de mortalidad, el inspector digita la tasa acumulada y el
    puntaje sale de los rangos del grupo productivo (RF30: ponedoras ≤12 % → 2,
    ≤14 % → 1, más → 0; engorde ≤6 % → 2, ≤9 % → 1, más → 0). Cuando sí se
    presentó y no es mortalidad, el inspector elige 0/1/2 con las descripciones
    del catálogo (RF19).
33. **El catálogo de M5 agrega `tipo_evaluacion` (puntaje o mortalidad) y
    `exige_firma_profesional`** a los indicadores (migración de esquema v6), y
    siembra las descripciones 0/1/2 de los diez MBG con las palabras del
    wireframe («No cumple o no presentó», «Cumple parcial», «Cumple completo»).
    Solo el POE exige firma de MV/MVZ; es provisional, como el resto del
    catálogo.
34. **El servidor normaliza la Fase III como la Fase II** (el servidor manda):
    sin documento fuerza puntaje 0 y descarta el chequeo; un indicador que no
    exige firma profesional no la guarda; la mortalidad recalcula su puntaje por
    rangos; y lo imposible se rechaza con un mensaje claro (puntaje que no es 0
    sin documento, mortalidad fuera de 0–100 %, más de 2 decimales o puntaje que
    no sale de los rangos). El frontend espeja las mismas reglas para validar al
    escribir y poder diligenciar sin conexión (RF12).
35. **El chequeo del documento es informativo** (RF28): legible y sin
    correcciones, firmado por el responsable y firma de MV/MVZ con matrícula
    vigente se registran, pero no bloquean la calificación. La firma profesional
    solo aparece en los documentos que la exigen (el POE).
36. **«Marcar pendiente» alterna y viaja con el borrador** (RF31): el pendiente
    cuenta como verificado en el avance —el «4 de 10» del wireframe incluye uno
    pendiente— y deja el documento para el plazo de cierre; el recálculo y el
    acta son de M7 (RF43/RF44). En traspatio la fase no existe (RF33): la
    pestaña queda gris como las que aún no se construyen y avisa al pulsarla, el
    componente avisa si el predio se reclasifica con la fase abierta, y el
    servidor rechaza guardar documentos.
37. **Desviaciones mínimas de la Fase III respecto al wireframe** (para no
    perder requisitos), a informar al entregar: «Guardar borrador» va como botón
    de texto discreto antes de «Siguiente documento →»; la pantalla de la
    mortalidad (que el wireframe no muestra) lleva el campo de tasa, el puntaje
    calculado en vivo y los rangos a la vista; y las acciones se acompañan de
    textos de apoyo con la referencia del requisito. No hay botón «Anterior»,
    como en el wireframe.
38. **El motor de cálculo es un módulo aislado y probable** (M6 · RF34–RF38):
    `backend/src/inspeccion/calculo.reglas.ts` hace las cuentas con las fórmulas
    de la metodología —indicador = promedio de los puntos × 100 / escala máxima
    (RF34); grupo = promedio de sus indicadores con valor × su peso (RF35);
    final = suma de los aportes (RF36)— y su espejo
    `frontend/src/app/core/inspeccion/calculo.modelos.ts` lo replica para
    mostrar el resultado en vivo y poder diligenciar sin conexión (RF12). Las
    cuentas van con precisión completa y se redondean a dos decimales solo los
    valores que se entregan (promedio, aporte y final); la clasificación (RF36:
    ≥90 Excelente, ≥75 Alto, ≥50 Medio, <50 Bajo) se decide sobre el final ya
    redondeado. El ejemplo verificado contra el motor del spike es 75,21 · Alto
    (RNF03) y quedó como prueba de ambos lados.
39. **La agregación entre galpones es el promedio de los valores por galpón**
    (interpretación a informar, la metodología no lo dice con todas las letras):
    el valor del indicador es el promedio de los galpones seleccionados que
    tienen valor; un galpón en «No aplica» no aporta (RF25). Si ningún galpón
    tiene valor, el indicador queda sin valor.
40. **Los parámetros de calificación salen del catálogo** (RF38, RNF17): los
    rangos de las escalas numéricas viven en `indicador.escala_rangos` (JSONB)
    por grupo productivo y los lee el motor; la migración v7 siembra los de la
    mortalidad (RF30: ponedoras ≤12 % → 2, ≤14 % → 1, más → 0; engorde ≤6 % → 2,
    ≤9 % → 1, más → 0). `RANGOS_MORTALIDAD` salió del código y de la API: la
    pantalla de la Fase III lee los rangos del catálogo, como el motor.
41. **Casos borde del cálculo** (a informar): un grupo sin promedio deja su
    aporte nulo (no 0) y el final suma solo los aportes con valor; si ningún
    grupo tiene datos, el final es nulo (no 0); un indicador que todos los
    galpones excluyeron con «No aplica» sale del promedio de su grupo; un
    documento pendiente sin puntaje deja la visita incompleta; y en traspatio
    MBG queda fuera del cálculo (RF33).
42. **El resultado se guarda con la inspección y el panel lee de ahí** (RF37):
    `inspeccion.resultado` (JSONB) guarda el cálculo completo y
    `visita.calificacion` / `visita.clasificacion` solo se publican cuando el
    cálculo quedó completo —si la visita deja de estarlo, se limpian—; el
    `promedioPorGrupo` del panel (RF10) sale de esos resultados (el peso solo se
    muestra si todas las visitas comparten perfil). La respuesta de la
    inspección lleva el bloque `calculo` (indicadores con detalle por galpón,
    grupos, final, clasificación y «completo»).
43. **Bloque «Resultado de la visita» en el panel de la Fase II** (desviación
    del wireframe, a informar al entregar): muestra los tres grupos con su
    promedio, el final, el nivel y, mientras falten datos, el aviso «Cálculo en
    curso»; se actualiza con cada guardado, tanto en línea como sin conexión
    (con el espejo del motor). El wireframe solo muestra los avances por
    indicador y galpón.
44. **El botón de una tarjeta sin encabezado va en el cuerpo, no en
    `[acciones]`** (hallazgo al corregir el PIN, 16 oct 2026): `app-tarjeta` solo
    proyecta el bloque de acciones cuando la tarjeta tiene `titulo`, así que el
    botón «Configurar» del bloque «Acceso sin conexión (PIN)» del panel —la
    única entrada para crear el PIN— nunca llegó a verse. El botón pasó al
    cuerpo de la tarjeta; el componente compartido no cambió.
45. **Entrar con PIN es abrir la sesión guardada** (RF03, RF12): el PIN es la
    llave del equipo, no una identidad. Descifra el token de refresco guardado
    (`ica.refresco`) y con él se trabaja, con o sin conexión; sin sesión
    guardada el ingreso se rechaza con un mensaje claro («No hay una sesión
    guardada en este equipo para entrar sin conexión. Ingrese con su
    contraseña.») en vez de dejar el armazón a medias. La identidad sale del
    perfil cacheado del equipo, nunca del correo del PIN.
46. **Cerrar sesión olvida el PIN del equipo** (RF03): al cerrar sesión de
    verdad se revoca la sesión ante el servidor, así que el PIN ya no tendría
    nada que abrir y solo confundiría en la pantalla de ingreso; «Cerrar sesión»
    y «Olvidar PIN» lo borran. El PIN solo se ofrece mientras haya una sesión
    recuperable en el equipo.
47. **La renovación de la sesión distingue el fallo de red del rechazo del
    servidor** (RF12): un fallo de red (sin conexión, `status 0`) no cierra la
    sesión —se sigue trabajando con lo guardado—; si es el servidor el que
    rechaza la sesión, se limpia, se avisa «Su sesión expiró. Ingrese de
    nuevo.» y se vuelve al ingreso. Antes, cualquier fallo al renovar —incluso
    sin token, al abrir con el PIN— cerraba la sesión sin navegar y dejaba el
    armazón solo con «Panel» y sin usuario.

## 8. Observaciones para la pasada de pulido final

Por ahora **no hay observaciones abiertas**: las detectadas en la primera
revisión de capturas (separación entre un párrafo y el primer campo, etiqueta del
buscador con icono de prefijo y desalineación de «Próximos módulos») se
corrigieron el 15 de octubre de 2026. Este apartado queda para lo que aparezca en
las siguientes revisiones.
