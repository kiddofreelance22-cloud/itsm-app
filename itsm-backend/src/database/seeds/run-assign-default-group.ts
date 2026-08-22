import dataSource from "../data-source";
import { assignDefaultGroupToIncidents } from "./assign-default-group-to-incidents";

/**
 * Standalone script to assign the default group to all open incidents.
 * Run with: npm run assign-default-group
 */
async function runAssignDefaultGroup(): Promise<void> {
  console.log("Initializing database connection...");
  await dataSource.initialize();

  try {
    console.log("\n=== Assigning Default Group to Open Incidents ===");
    await assignDefaultGroupToIncidents(dataSource);
    console.log("\n✅ Assignment complete.");
  } catch (error) {
    console.error("\n❌ Assignment failed:", error);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

runAssignDefaultGroup().catch((error) => {
  console.error("Unexpected error while assigning default group:", error);
  process.exit(1);
});