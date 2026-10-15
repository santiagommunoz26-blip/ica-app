import { dataSource } from './data-source.js';
import { describirError } from '../common/describir-error.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { EstadoUsuario, Rol } from '../common/roles.js';
import {
  generarPasswordTemporal,
  hashearSecreto,
  problemasDePassword,
} from '../common/password.js';
import { limpiarTexto, normalizarCorreo } from '../common/texto.js';

/**
 * Crea el primer usuario administrador (o restablece su contraseña).
 *
 * Es necesario porque el sistema arranca sin usuarios y solo un
 * administrador puede crear usuarios (RF05). No se guardan credenciales en el
 * repositorio: se pasan por parámetro o por variable de entorno, y si no se
 * indica contraseña se genera una y se imprime una sola vez.
 *
 * Uso:
 *   npm run seed:admin -- --correo=admin@entidad.gov.co --nombre="Ana Ruiz"
 *   (opcional) --password="Temporal2026*"
 * Variables equivalentes: SEED_ADMIN_CORREO, SEED_ADMIN_NOMBRE, SEED_ADMIN_PASSWORD
 */
function leerArgumento(nombre: string): string | undefined {
  const prefijo = `--${nombre}=`;
  const argumento = process.argv
    .slice(2)
    .find((valor) => valor.startsWith(prefijo));
  return argumento?.slice(prefijo.length);
}

async function main(): Promise<void> {
  const correoCrudo = leerArgumento('correo') ?? process.env.SEED_ADMIN_CORREO;
  const nombreCrudo =
    leerArgumento('nombre') ?? process.env.SEED_ADMIN_NOMBRE ?? 'Administrador';
  const passwordCrudo =
    leerArgumento('password') ?? process.env.SEED_ADMIN_PASSWORD;

  if (!correoCrudo) {
    throw new Error(
      'Falta el correo del administrador. Uso: npm run seed:admin -- --correo=admin@entidad.gov.co [--nombre="Ana Ruiz"] [--password="..."]',
    );
  }

  const correo = normalizarCorreo(correoCrudo);
  const nombreCompleto = limpiarTexto(nombreCrudo);
  const password = passwordCrudo ?? generarPasswordTemporal();
  const problemas = problemasDePassword(password);
  if (problemas.length > 0) {
    throw new Error(
      `La contraseña no cumple la política: ${problemas.join(', ')}.`,
    );
  }

  await dataSource.initialize();
  const repositorio = dataSource.getRepository(Usuario);

  const existente = await repositorio.findOne({ where: { correo } });
  const passwordHash = await hashearSecreto(password);

  if (existente) {
    existente.nombreCompleto = nombreCompleto;
    existente.passwordHash = passwordHash;
    existente.rol = Rol.ADMINISTRADOR;
    existente.estado = EstadoUsuario.ACTIVO;
    existente.debeCambiarPassword = true;
    await repositorio.save(existente);
    console.log(`\nAdministrador actualizado: ${correo}`);
  } else {
    const creado = repositorio.create({
      correo,
      nombreCompleto,
      passwordHash,
      rol: Rol.ADMINISTRADOR,
      estado: EstadoUsuario.ACTIVO,
      debeCambiarPassword: true,
    });
    await repositorio.save(creado);
    console.log(`\nAdministrador creado: ${correo}`);
  }

  console.log('---------------------------------------------');
  console.log(`  Usuario:     ${correo}`);
  console.log(`  Contraseña:  ${password}`);
  console.log('---------------------------------------------');
  console.log(
    'La contraseña es temporal: el sistema pedirá cambiarla en el primer acceso (RF07).',
  );
  console.log(
    'No se guarda en ningún archivo. Guárdela en su gestor de contraseñas.\n',
  );
}

try {
  await main();
} catch (error) {
  console.error(
    `\nError al crear el administrador: ${describirError(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}
