// Configuración de Karma para las pruebas unitarias del frontend.
//
// Se declara explícitamente para registrar launchers distintos de Chrome:
// - En CI se usa ChromeHeadless (viene instalado en el runner).
// - En local, si no hay Chrome/Chromium, se puede usar Firefox:
//     make test-frontend KARMA_BROWSER=FirefoxHeadless
module.exports = function (config) {
  config.set({
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-firefox-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    jasmineHtmlReporter: {
      suppressAll: true,
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadless'],
    // Variante para CI (contenedores): evita el sandbox de Chrome.
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
