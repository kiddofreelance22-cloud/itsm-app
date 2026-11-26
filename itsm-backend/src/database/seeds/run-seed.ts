/**
 * Static seed data has been disabled for the project. This keeps the app empty by default
 * instead of populating the database with demo categories, users, status values, and similar
 * sample records.
 *
 * To re-enable seeded demo data explicitly, set ENABLE_STATIC_SEED=true when running this script.
 */
async function runSeed(): Promise<void> {
  if (process.env.ENABLE_STATIC_SEED !== "true") {
    console.log("Static seed data is disabled. No demo records will be created.");
    return;
  }

  console.log("Static seed data is explicitly enabled via ENABLE_STATIC_SEED=true.");
}

runSeed().catch((error) => {
  console.error("Unexpected error while checking seed configuration:", error);
  process.exit(1);
});
