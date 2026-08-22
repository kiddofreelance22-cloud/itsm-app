import { DataSource } from "typeorm";

/**
 * Seeds the AssignmentGroup table with common IT support groups.
 * Groups are created without specific members for now; members can be
 * added separately through the application or admin interface.
 */
export async function seedAssignmentGroups(
  dataSource: DataSource
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("Clearing existing assignment groups...");
    await queryRunner.query(`DELETE FROM "assignment_group_members"`);
    await queryRunner.query(`DELETE FROM "assignment_groups"`);

    console.log("Seeding assignment groups...");
    const assignmentGroups = [
      {
        groupName: "Hardware Support",
        groupCode: "GRP_HARDWARE",
        description: "Handles desktop, laptop, and peripheral hardware issues",
      },
      {
        groupName: "Software Support",
        groupCode: "GRP_SOFTWARE",
        description:
          "Handles application installation, updates, and software-related issues",
      },
      {
        groupName: "Network Support",
        groupCode: "GRP_NETWORK",
        description: "Handles network connectivity, WiFi, and VPN issues",
      },
      {
        groupName: "Email & Collaboration",
        groupCode: "GRP_EMAIL",
        description: "Handles email, calendar, and collaboration tools",
      },
      {
        groupName: "Access & Security",
        groupCode: "GRP_SECURITY",
        description:
          "Handles user access, permissions, password resets, and security issues",
      },
      {
        groupName: "Database Support",
        groupCode: "GRP_DATABASE",
        description: "Handles database performance, backups, and data recovery",
      },
      {
        groupName: "General Support",
        groupCode: "GRP_GENERAL",
        description: "Handles general IT support and miscellaneous issues",
        isDefault: true,
      },
    ];

    for (const group of assignmentGroups) {
      await queryRunner.query(
        `
        INSERT INTO "assignment_groups" ("group_name", "group_code", "description", "is_active", "is_default", "created_at")
        VALUES ($1, $2, $3, $4, $5, now())
      `,
        [group.groupName, group.groupCode, group.description, true, group.isDefault || false]
      );
    }

    console.log(`  - Seeded ${assignmentGroups.length} assignment groups`);
  } finally {
    await queryRunner.release();
  }
}
