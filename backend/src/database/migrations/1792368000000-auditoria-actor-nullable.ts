import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditoriaActorNullable1792368000000 implements MigrationInterface {
  name = 'AuditoriaActorNullable1792368000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auditoria_modulo" ALTER COLUMN "actor_id" DROP NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const filas = (await queryRunner.query(
      `SELECT count(*)::int AS "total" FROM "auditoria_modulo" WHERE "actor_id" IS NULL`,
    )) as Array<{ total: number }>;
    if (filas[0]?.total > 0) {
      throw new Error(
        'No se puede revertir: hay eventos del sistema sin actor_id en la auditoría.',
      );
    }
    await queryRunner.query(
      `ALTER TABLE "auditoria_modulo" ALTER COLUMN "actor_id" SET NOT NULL`,
    );
  }
}
