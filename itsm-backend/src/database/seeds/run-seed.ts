import dataSource from "../data-source";
import { cleanAndSeedRoles } from "./clean-and-seed-roles";
import { seedAdminUser } from "./seed-admin-user";
import { seedAnalystUser } from "./seed-analyst-user";
import { seedStatus } from "./seed-status";
import { seedCategories } from "./seed-categories";
import { seedImpacts } from "./seed-impacts";
import { seedUrgency } from "./seed-urgency";
import { seedAssignmentGroups } from "./seed-assignment-groups";
import { log } from "console";
import { seedPriorities } from "./seed-priorities";
import { seedDepartments } from "./seed-departments";

/**
 * Entry point for `npm run seed`. Initializes the TypeORM connection,
 * runs each seed function in dependency order, then closes the connection.
 * 
 * Seed order:
 * 1. Roles and permissions (required for admin user)
 * 2. Status, Impact, Urgency (independent)
 * 3. Categories and Subcategories (categories first for FK)
 * 4. Assignment Groups (for incident assignment)
 * 5. Departments (for user profile assignment)
 * 6. Admin user (depends on roles)
 * 7. Analyst user (depends on roles)
 */
async function runSeed(): Promise<void> {
  console.log("Initializing database connection...");
  await dataSource.initialize();

  try {
    console.log("\n=== Seeding Core Data ===");

    console.log("\n[1/6] Cleaning up and seeding roles with permissions...");
    await cleanAndSeedRoles(dataSource);

    console.log("\n[2/6] Seeding statuses...");
    await seedStatus(dataSource);

    console.log("\n[3/6] Seeding categories and subcategories...");
    await seedCategories(dataSource);

    console.log("\n[4/6] Seeding impact levels...");
    await seedImpacts(dataSource);

    console.log("\n[5/6] Seeding urgency levels...");
    await seedUrgency(dataSource);

    console.log("\n[6/8] Seeding assignment groups...");
    await seedAssignmentGroups(dataSource);

    console.log("\n[7/8] Seeding departments...");
    await seedDepartments(dataSource);

    console.log("\n[8/8] Seeding admin user...");
    await seedAdminUser(dataSource);

    console.log("\n[9/9] Seeding analyst user...");
    await seedAnalystUser(dataSource);

    console.log("\n[10/10] Seeding priorities..")
    await seedPriorities(dataSource);

    console.log("\n✅ Seeding complete.");
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

runSeed().catch((error) => {
  console.error("Unexpected error while seeding:", error);
  process.exit(1);
});
