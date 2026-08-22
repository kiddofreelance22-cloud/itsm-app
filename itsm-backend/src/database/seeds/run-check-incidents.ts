import dataSource from "../data-source";
import { checkIncidents } from "./check-incidents";

/**
 * Standalone script to check current incident status.
 * Run with: npm run check-incidents
 */
async function runCheckIncidents(): Promise<void> {
  console.log("Initializing database connection...");
  await dataSource.initialize();

  try {
    await checkIncidents(dataSource);
  } catch (error) {
    console.error("\n❌ Check failed:", error);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

runCheckIncidents().catch((error) => {
  console.error("Unexpected error while checking incidents:", error);
  process.exit(1);
});