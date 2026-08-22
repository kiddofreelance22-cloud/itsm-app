import dataSource from "../data-source";
import { seedSampleIncidents } from "./seed-sample-incidents";

/**
 * Standalone script to seed sample incidents.
 * Run with: npm run seed-sample-incidents
 */
async function runSeedSampleIncidents(): Promise<void> {
  console.log("Initializing database connection...");
  await dataSource.initialize();

  try {
    console.log("\n=== Seeding Sample Incidents ===");
    await seedSampleIncidents(dataSource);
    console.log("\n✅ Sample incidents seeding complete.");
  } catch (error) {
    console.error("\n❌ Sample incidents seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

runSeedSampleIncidents().catch((error) => {
  console.error("Unexpected error while seeding sample incidents:", error);
  process.exit(1);
});