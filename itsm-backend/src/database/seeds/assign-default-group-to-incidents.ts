import { DataSource } from "typeorm";

/**
 * Updates all open incidents without an assignment group to use the default group.
 * This ensures that analysts can see and work with all open incidents in the queue.
 */
export async function assignDefaultGroupToIncidents(
  dataSource: DataSource
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("Finding default assignment group...");
    const defaultGroupResult = await queryRunner.query(
      `SELECT group_id, group_name FROM assignment_groups WHERE is_default = true AND is_active = true LIMIT 1`
    );

    if (defaultGroupResult.length === 0) {
      console.log("No default assignment group found. Skipping incident updates.");
      return;
    }

    const defaultGroup = defaultGroupResult[0];
    console.log(`Found default group: ${defaultGroup.group_name} (ID: ${defaultGroup.group_id})`);

    console.log("Finding open incidents without assignment group...");
    const incidentsWithoutGroup = await queryRunner.query(
      `SELECT incident_id, incident_code, title FROM incidents 
       WHERE group_id IS NULL 
       AND status NOT IN ('Resolved', 'Closed')`
    );

    if (incidentsWithoutGroup.length === 0) {
      console.log("No open incidents without assignment group found.");
      return;
    }

    console.log(`Found ${incidentsWithoutGroup.length} open incidents without assignment group.`);

    console.log("Updating incidents to use default group...");
    const result = await queryRunner.query(
      `UPDATE incidents 
       SET group_id = $1, updated_at = now() 
       WHERE group_id IS NULL 
       AND status NOT IN ('Resolved', 'Closed')`,
      [defaultGroup.group_id]
    );

    console.log(`✅ Successfully updated ${result} incidents to default group "${defaultGroup.group_name}".`);
    
    // Show some examples of updated incidents
    const sampleIncidents = await queryRunner.query(
      `SELECT incident_code, title FROM incidents 
       WHERE group_id = $1 
       AND status NOT IN ('Resolved', 'Closed') 
       LIMIT 5`,
      [defaultGroup.group_id]
    );
    
    console.log("\nSample updated incidents:");
    sampleIncidents.forEach((incident: any) => {
      console.log(`  - ${incident.incident_code}: ${incident.title}`);
    });

  } finally {
    await queryRunner.release();
  }
}