import { DataSource } from "typeorm";

/**
 * Seeds the Impact table with common incident impact levels.
 */
export async function seedImpacts(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("Clearing existing impacts...");
    await queryRunner.query(`DELETE FROM "impacts"`);

    console.log("Seeding impact levels...");
    const impacts = [
      {
        impactName: "Low",
        impactCode: "IMP_LOW",
        description: "Affects a single user or small group",
        order: 1,
      },
      {
        impactName: "Medium",
        impactCode: "IMP_MEDIUM",
        description: "Affects a department or significant group of users",
        order: 2,
      },
      {
        impactName: "High",
        impactCode: "IMP_HIGH",
        description: "Affects multiple departments or critical services",
        order: 3,
      },
      {
        impactName: "Critical",
        impactCode: "IMP_CRITICAL",
        description: "Affects all users or critical business services",
        order: 4,
      },
    ];

    for (const impact of impacts) {
      await queryRunner.query(
        `
        INSERT INTO "impacts" ("impact_name", "impact_code", "description", "order", "is_active", "created_at")
        VALUES ($1, $2, $3, $4, $5, now())
      `,
        [impact.impactName, impact.impactCode, impact.description, impact.order, true]
      );
    }

    console.log(`  - Seeded ${impacts.length} impact levels`);
  } finally {
    await queryRunner.release();
  }
}
