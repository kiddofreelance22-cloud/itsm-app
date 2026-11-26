/**
 * Sample incident seeding is disabled.
 * This project intentionally does not create demo incident data.
 */
async function runSeedSampleIncidents(): Promise<void> {
  console.log("Sample incident seeding is disabled. No static data will be created.");
}

runSeedSampleIncidents().catch((error) => {
  console.error("Unexpected error while checking seed configuration:", error);
  process.exit(1);
});