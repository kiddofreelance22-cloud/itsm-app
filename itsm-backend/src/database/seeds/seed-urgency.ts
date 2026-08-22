import { DataSource } from "typeorm";

/**
 * Seeds the Urgency table with common incident urgency levels.
 */
export async function seedUrgency(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("Clearing existing urgencies...");
    await queryRunner.query(`DELETE FROM "urgencies"`);

    console.log("Seeding urgency levels...");
    const urgencies = [
      {
        urgencyName: "Low",
        urgencyCode: "URG_LOW",
        description: "Can wait, no immediate action required",
        order: 1,
      },
      {
        urgencyName: "Medium",
        urgencyCode: "URG_MEDIUM",
        description: "Should be addressed soon",
        order: 2,
      },
      {
        urgencyName: "High",
        urgencyCode: "URG_HIGH",
        description: "Requires prompt attention",
        order: 3,
      },
      {
        urgencyName: "Critical",
        urgencyCode: "URG_CRITICAL",
        description: "Requires immediate attention",
        order: 4,
      },
    ];

    for (const urgency of urgencies) {
      await queryRunner.query(
        `
        INSERT INTO "urgencies" ("urgency_name", "urgency_code", "description", "order", "is_active", "created_at")
        VALUES ($1, $2, $3, $4, $5, now())
      `,
        [urgency.urgencyName, urgency.urgencyCode, urgency.description, urgency.order, true]
      );
    }

    console.log(`  - Seeded ${urgencies.length} urgency levels`);
  } finally {
    await queryRunner.release();
  }
}
