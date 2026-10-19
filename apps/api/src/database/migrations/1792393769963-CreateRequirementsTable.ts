import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRequirementsTable1792393769963 implements MigrationInterface {
  name = 'CreateRequirementsTable1792393769963';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "requirements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "project_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text NOT NULL, "reference_key" character varying(100), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4e966e20a0ebaf89e4c1ed664a4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_requirements_project_id" ON "requirements"  ("project_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "requirements" ADD CONSTRAINT "FK_18813b088aecff70a16373eff7c" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "requirements" DROP CONSTRAINT "FK_18813b088aecff70a16373eff7c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_requirements_project_id"`,
    );
    await queryRunner.query(`DROP TABLE "requirements"`);
  }
}
