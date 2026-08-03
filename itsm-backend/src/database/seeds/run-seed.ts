import dataSource from "../data-source";
import { cleanAndSeedRoles } from "./clean-and-seed-roles";
import { seedAdminUser } from "./seed-admin-user";

/**
 * Entry point for `npm run seed`. Initializes the TypeORM connection,
 * runs each seed function in dependency order (clean and seed roles before
 * the admin user, since the admin user is assigned the Admin role), then closes
 * the connection.
 */
async function runSeed(): Promise<void> {
  console.log("Initializing database connection...");
  await dataSource.initialize();

  try {
    console.log("Cleaning up and seeding roles with permissions...");
    await cleanAndSeedRoles(dataSource);

    console.log("Seeding admin user...");
    await seedAdminUser(dataSource);

    console.log("Seeding complete.");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

runSeed().catch((error) => {
  console.error("Unexpected error while seeding:", error);
  process.exit(1);
});
