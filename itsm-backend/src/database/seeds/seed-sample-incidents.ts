import { DataSource } from "typeorm";

/**
 * Seeds sample incidents for testing purposes.
 * Creates realistic IT support incidents with General Support group assignment.
 */
export async function seedSampleIncidents(
  dataSource: DataSource
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("Clearing existing sample incidents...");
    await queryRunner.query(`DELETE FROM incidents`);

    console.log("Finding default assignment group and users...");
    const defaultGroupResult = await queryRunner.query(
      `SELECT group_id, group_name FROM assignment_groups WHERE is_default = true AND is_active = true LIMIT 1`
    );

    if (defaultGroupResult.length === 0) {
      console.log("No default assignment group found. Please seed assignment groups first.");
      return;
    }

    const defaultGroup = defaultGroupResult[0];
    console.log(`Using default group: ${defaultGroup.group_name} (ID: ${defaultGroup.group_id})`);

    const usersResult = await queryRunner.query(
      `SELECT user_id, username FROM users WHERE is_active = true LIMIT 5`
    );

    if (usersResult.length === 0) {
      console.log("No users found. Please seed users first.");
      return;
    }

    const users = usersResult;
    console.log(`Found ${users.length} users for incident creation.`);

    console.log("Seeding sample incidents...");
    const sampleIncidents = [
      {
        incidentId: "INC001",
        incidentCode: "INC000001",
        title: "Laptop not connecting to WiFi",
        description: "User reports that their laptop cannot connect to the corporate WiFi network. Network adapter appears to be functioning but no networks are visible.",
        priority: "High",
        impact: "Medium",
        urgency: "High",
        status: "Open",
        groupId: defaultGroup.group_id,
        assignedTo: null,
        createdBy: users[0].user_id,
      },
      {
        incidentId: "INC002",
        incidentCode: "INC000002",
        title: "Email server not responding",
        description: "Multiple users reporting that they cannot access email. Exchange server appears to be down or not responding to requests.",
        priority: "Critical",
        impact: "High",
        urgency: "Critical",
        status: "Open",
        groupId: defaultGroup.group_id,
        assignedTo: null,
        createdBy: users[0].user_id,
      },
      {
        incidentId: "INC003",
        incidentCode: "INC000003",
        title: "Printer jam on floor 3",
        description: "Main printer on floor 3 has a paper jam and is not functioning. Users cannot print important documents.",
        priority: "Medium",
        impact: "Low",
        urgency: "Medium",
        status: "Open",
        groupId: defaultGroup.group_id,
        assignedTo: null,
        createdBy: users[0].user_id,
      },
      {
        incidentId: "INC004",
        incidentCode: "INC000004",
        title: "VPN connection drops frequently",
        description: "User reports that VPN connection drops every few minutes when working from home. This is affecting productivity.",
        priority: "Medium",
        impact: "Medium",
        urgency: "Medium",
        status: "In Progress",
        groupId: defaultGroup.group_id,
        assignedTo: users[1]?.user_id || null,
        createdBy: users[0].user_id,
      },
      {
        incidentId: "INC005",
        incidentCode: "INC000005",
        title: "Software installation request - Adobe Creative Suite",
        description: "User needs Adobe Creative Suite installed on their workstation for design work. License needs to be procured.",
        priority: "Low",
        impact: "Low",
        urgency: "Low",
        status: "Open",
        groupId: defaultGroup.group_id,
        assignedTo: null,
        createdBy: users[0].user_id,
      },
      {
        incidentId: "INC006",
        incidentCode: "INC000006",
        title: "Monitor display flickering",
        description: "User's monitor display is flickering intermittently. Makes it difficult to work for extended periods.",
        priority: "Medium",
        impact: "Low",
        urgency: "Medium",
        status: "Open",
        groupId: defaultGroup.group_id,
        assignedTo: null,
        createdBy: users[0].user_id,
      },
      {
        incidentId: "INC007",
        incidentCode: "INC000007",
        title: "Database backup failed overnight",
        description: "Automated database backup job failed during the night. Need to investigate logs and rerun backup.",
        priority: "High",
        impact: "High",
        urgency: "High",
        status: "Open",
        groupId: defaultGroup.group_id,
        assignedTo: null,
        createdBy: users[0].user_id,
      },
      {
        incidentId: "INC008",
        incidentCode: "INC000008",
        title: "User cannot access shared folder",
        description: "User reports they suddenly lost access to shared department folder. Other users in same department can access it fine.",
        priority: "Medium",
        impact: "Medium",
        urgency: "Medium",
        status: "Open",
        groupId: defaultGroup.group_id,
        assignedTo: null,
        createdBy: users[0].user_id,
      },
    ];

    for (const incident of sampleIncidents) {
      await queryRunner.query(
        `
        INSERT INTO incidents (
          incident_id, incident_code, title, description, priority, impact, urgency, 
          status, group_id, assigned_to, created_by, created_at, updated_at, 
          sla_response_target, sla_resolution_target, sla_response_met, sla_breached
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now(), now() + interval '4 hours', now() + interval '24 hours', false, false)
      `,
        [
          incident.incidentId,
          incident.incidentCode,
          incident.title,
          incident.description,
          incident.priority,
          incident.impact,
          incident.urgency,
          incident.status,
          incident.groupId,
          incident.assignedTo,
          incident.createdBy,
        ]
      );
    }

    console.log(`✅ Seeded ${sampleIncidents.length} sample incidents.`);

    // Show summary
    const summary = await queryRunner.query(`
      SELECT status, COUNT(*) as count 
      FROM incidents 
      GROUP BY status
    `);
    console.log("\nIncident summary:");
    summary.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count}`);
    });

  } finally {
    await queryRunner.release();
  }
}