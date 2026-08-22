import { DataSource } from "typeorm";

/**
 * Seeds the Priority table with standard ITSM priority levels and their
 * response/resolution SLA targets (in minutes). Idempotent — clears and
 * re-inserts, same convention as seedUrgency/seedImpacts.
 */
export async function seedPriorities(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("Clearing existing priorities...");
    await queryRunner.query(`DELETE FROM "priorities"`);

    console.log("Seeding priority levels...");
    const priorities = [
      {
        priorityName: "Critical",
        priorityCode: "P1_CRITICAL",
        description: "Business-critical outage. All hands, immediate response.",
        order: 1,
        responseSlaMinutes: 15,
        resolutionSlaMinutes: 4 * 60, // 4 hours
      },
      {
        priorityName: "High",
        priorityCode: "P2_HIGH",
        description: "Significant impact to a team or service. Respond promptly.",
        order: 2,
        responseSlaMinutes: 30,
        resolutionSlaMinutes: 8 * 60, // 8 hours
      },
      {
        priorityName: "Medium",
        priorityCode: "P3_MODERATE",
        description: "Standard priority. Normal business impact.",
        order: 3,
        responseSlaMinutes: 2 * 60, // 2 hours
        resolutionSlaMinutes: 24 * 60, // 1 day
      },
      {
        priorityName: "Low",
        priorityCode: "P4_LOW",
        description: "Minor issue or general request. No urgent business impact.",
        order: 4,
        responseSlaMinutes: 4 * 60, // 4 hours
        resolutionSlaMinutes: 5 * 24 * 60, // 5 days
      },
    ];

    for (const p of priorities) {
      await queryRunner.query(
        `
        INSERT INTO "priorities"
          ("priority_name", "priority_code", "description", "order",
           "response_sla_minutes", "resolution_sla_minutes", "is_active", "created_at")
        VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      `,
        [
          p.priorityName,
          p.priorityCode,
          p.description,
          p.order,
          p.responseSlaMinutes,
          p.resolutionSlaMinutes,
          true,
        ]
      );
    }

    console.log(`  - Seeded ${priorities.length} priority levels`);
  } finally {
    await queryRunner.release();
  }
}