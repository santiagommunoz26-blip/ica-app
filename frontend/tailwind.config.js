/** @type {import('tailwindcss').Config} */
// Tokens de Tailwind para el Aplicativo EBA Aves.
// Los valores NO se escriben aquí: se leen de las variables CSS que publica
// frontend/src/theme/_tokens.scss (única fuente de diseño). Así, cambiar la
// marca o un radio es cambiar los tokens, no los componentes.
//
// Nota: al ser variables CSS, los modificadores de opacidad de Tailwind
// (por ejemplo `bg-marca/50`) no están disponibles; para eso existen los
// tonos `*-suave` y `*-tenue` de cada color.
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // Marca (verde esmeralda) — color primario de la aplicación.
        marca: {
          DEFAULT: 'var(--color-marca)',
          fuerte: 'var(--color-marca-fuerte)',
          media: 'var(--color-marca-media)',
          suave: 'var(--color-marca-suave)',
          tenue: 'var(--color-marca-tenue)',
          contraste: 'var(--color-sobre-marca)',
        },
        // Acento (lima) — realces, acciones secundarias destacadas.
        acento: {
          DEFAULT: 'var(--color-acento)',
          fuerte: 'var(--color-acento-fuerte)',
          suave: 'var(--color-acento-suave)',
          contraste: 'var(--color-sobre-acento)',
        },
        // Superficies.
        fondo: 'var(--color-fondo)',
        velo: 'var(--color-velo)',
        superficie: {
          DEFAULT: 'var(--color-superficie)',
          alterna: 'var(--color-superficie-alterna)',
        },
        // Bordes.
        borde: {
          DEFAULT: 'var(--color-borde)',
          fuerte: 'var(--color-borde-fuerte)',
        },
        // Texto.
        contenido: {
          DEFAULT: 'var(--color-texto)',
          suave: 'var(--color-texto-suave)',
          deshabilitado: 'var(--color-texto-deshabilitado)',
        },
        // Estados.
        exito: {
          DEFAULT: 'var(--color-exito)',
          suave: 'var(--color-exito-suave)',
          contraste: 'var(--color-sobre-exito)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          suave: 'var(--color-info-suave)',
          contraste: 'var(--color-sobre-info)',
        },
        advertencia: {
          DEFAULT: 'var(--color-advertencia)',
          suave: 'var(--color-advertencia-suave)',
          texto: 'var(--color-advertencia-texto)',
          contraste: 'var(--color-sobre-advertencia)',
        },
        peligro: {
          DEFAULT: 'var(--color-peligro)',
          suave: 'var(--color-peligro-suave)',
          contraste: 'var(--color-sobre-peligro)',
        },
        // Clasificación del bienestar (metodología ICA v2.0).
        nivel: {
          excelente: 'var(--color-nivel-excelente)',
          alto: 'var(--color-nivel-alto)',
          medio: 'var(--color-nivel-medio)',
          bajo: 'var(--color-nivel-bajo)',
        },
      },
      borderRadius: {
        xs: 'var(--radio-xs)',
        sm: 'var(--radio-sm)',
        md: 'var(--radio-md)',
        lg: 'var(--radio-lg)',
        xl: 'var(--radio-xl)',
        full: 'var(--radio-full)',
        campo: 'var(--radio-md)',
        tarjeta: 'var(--radio-lg)',
      },
      boxShadow: {
        suave: 'var(--sombra-1)',
        media: 'var(--sombra-2)',
        alta: 'var(--sombra-3)',
        foco: 'var(--sombra-foco)',
      },
      spacing: {
        xs: 'var(--espacio-xs)',
        sm: 'var(--espacio-sm)',
        md: 'var(--espacio-md)',
        lg: 'var(--espacio-lg)',
        xl: 'var(--espacio-xl)',
        '2xl': 'var(--espacio-2xl)',
      },
      fontFamily: {
        base: ['var(--fuente-base)'],
      },
      maxWidth: {
        contenido: 'var(--ancho-contenido)',
      },
      minHeight: {
        control: 'var(--altura-control)',
      },
    },
  },
  plugins: [],
};
