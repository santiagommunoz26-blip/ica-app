import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Publico } from '../common/decorators/acceso.decorators.js';

/**
 * Comprobación de vida de la API. Es pública (no exige sesión) porque la usan
 * los monitoreos y los despliegues (Cloud Run / Docker) para saber si el
 * servicio está sano.
 */
@Publico()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
  ) {}

  /** GET /health -> 200 si la API y la base de datos responden. */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.database.pingCheck('database', { timeout: 2000 }),
    ]);
  }
}
