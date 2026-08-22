import { DataSource } from "typeorm";

/**
 * Checks the current state of incidents in the database.
 */
export async function checkIncidents(
  dataSource: DataSource
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("=== Current Incident Status ===\n");

    // Count total incidents
    const totalResult = await queryRunner.query(`SELECT COUNT(*) as count FROM incidents`);
    console.log(`Total incidents: ${totalResult[0].count}`);

    // Check incidents by status
    const statusResult = await queryRunner.query(`
      SELECT status, COUNT(*) as count 
      FROM incidents 
      GROUP BY status
    `);
    console.log("\nIncidents by status:");
    statusResult.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    // Check incidents by assignment group
    const groupResult = await queryRunner.query(`
      SELECT 
        COALESCE(ag.group_name, 'No Group') as group_name,
        COUNT(*) as count 
      FROM incidents i
      LEFT JOIN assignment_groups ag ON i.group_id = ag.group_id
      GROUP BY ag.group_name
    `);
    console.log("\nIncidents by assignment group:");
    groupResult.forEach((row: any) => {
      console.log(`  ${row.group_name}: ${row.count}`);
    });

    // Show sample incidents
    const sampleResult = await queryRunner.query(`
      SELECT 
        incident_code, 
        title, 
        status, 
        COALESCE(ag.group_name, 'No Group') as group_name,
        COALESCE(u.username, 'Unassigned') as assigned_to
      FROM incidents i
      LEFT JOIN assignment_groups ag ON i.group_id = ag.group_id
      LEFT JOIN users u ON i.assigned_to = u.user_id
      LIMIT 10
    `);
    console.log("\nSample incidents:");
    sampleResult.forEach((row: any) => {
      console.log(`  ${row.incident_code}: ${row.title}`);
      console.log(`    Status: ${row.status}, Group: ${row.group_name}, Assigned: ${row.assigned_to}`);
    });

  } finally {
    await queryRunner.release();
  }
}