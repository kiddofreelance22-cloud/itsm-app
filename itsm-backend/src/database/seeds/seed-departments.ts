import { DataSource } from "typeorm";
import { DEPARTMENTS_SEED_DATA } from "../../modules/departments/departments.seed";

/**
 * Seeds the departments lookup table with common organizational
 * departments. Idempotent: existing departments (matched by unique
 * department_code) are left untouched so admin edits aren't overwritten
 * on re-seed, and any departments carried forward from legacy free-text
 * data by the CreateDepartmentsTable migration are preserved as-is.
 */
export async function seedDepartments(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("Seeding departments...");
    let inserted = 0;

    for (const dept of DEPARTMENTS_SEED_DATA) {
      const result = await queryRunner.query(
        `
        INSERT INTO "departments"
          ("department_name", "department_code", "description", "is_active", "available_in_portal", "created_at", "updated_at")
        VALUES ($1, $2, $3, $4, $5, now(), now())
        ON CONFLICT ("department_code") DO NOTHING
        RETURNING "department_id"
        `,
        [
          dept.departmentName,
          dept.departmentCode,
          dept.description ?? null,
          dept.isActive ?? true,
          dept.availableInPortal ?? true,
        ]
      );
      if (result.length) inserted += 1;
    }

    console.log(`  - Seeded ${inserted} new department(s) (${DEPARTMENTS_SEED_DATA.length - inserted} already existed)`);
  } finally {
    await queryRunner.release();
  }
}
