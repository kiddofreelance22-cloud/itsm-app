import { DataSource } from "typeorm";

/**
 * Seeds the Status table with common incident statuses.
 */
export async function seedStatus(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("Clearing existing statuses...");
    await queryRunner.query(`DELETE FROM "statuses"`);

    console.log("Seeding incident statuses...");
    const statuses = [
      { statusName: "Open", statusCode: "ST_OPEN", isOpen: true, type: "incident" },
      { statusName: "Assigned", statusCode: "ST_ASSIGNED", isOpen: true, type: "incident" },
      { statusName: "In Progress", statusCode: "ST_IN_PROGRESS", isOpen: true, type: "incident" },
      { statusName: "On Hold", statusCode: "ST_ON_HOLD", isOpen: true, type: "incident" },
      { statusName: "Resolved", statusCode: "ST_RESOLVED", isOpen: false, type: "incident" },
      { statusName: "Closed", statusCode: "ST_CLOSED", isOpen: false, type: "incident" },
    ];

    for (const status of statuses) {
      await queryRunner.query(
        `
        INSERT INTO "statuses" ("status_name", "status_code", "type", "is_open", "is_active", "created_at")
        VALUES ($1, $2, $3, $4, $5, now())
      `,
        [status.statusName, status.statusCode, status.type, status.isOpen, true]
      );
    }

    console.log(`  - Seeded ${statuses.length} statuses`);
  } finally {
    await queryRunner.release();
  }
}
