import { DataSource } from "typeorm";

/**
 * Cleans up all users and user roles, then seeds fresh roles and permissions.
 */
export async function cleanAndSeedRoles(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();

    console.log("Deleting dependent data (incidents, requests, etc)...");
    // Delete incidents first (they reference users and other tables)
    await queryRunner.query(`DELETE FROM "incidents"`);
    // Delete requests and related data
    await queryRunner.query(`DELETE FROM "request_history"`);
    await queryRunner.query(`DELETE FROM "request_variable_values"`);
    await queryRunner.query(`DELETE FROM "requests"`);
    // Delete comments
    await queryRunner.query(`DELETE FROM "incident_comments"`);
    // Delete tasks
    await queryRunner.query(`DELETE FROM "tasks"`);
    // Delete assignment group members
    await queryRunner.query(`DELETE FROM "assignment_group_members"`);
    // Delete catalogs and variables
    await queryRunner.query(`DELETE FROM "catalog_variable_options"`);
    await queryRunner.query(`DELETE FROM "catalog_variables"`);
    await queryRunner.query(`DELETE FROM "catalogs"`);
    // Delete user_roles first (foreign key constraint)
    await queryRunner.query(`DELETE FROM "user_roles"`);
    // Delete users
    await queryRunner.query(`DELETE FROM "users"`);

    console.log("Deleting all existing roles (except Admin)...");
    // Clear role_permissions
    await queryRunner.query(`DELETE FROM "role_permissions"`);
    // Clear old roles
    await queryRunner.query(`DELETE FROM "roles"`);

    console.log("Clearing permissions...");
    await queryRunner.query(`DELETE FROM "permissions"`);

    console.log("Seeding roles...");
    const roles = [
      { roleName: "Administrator", roleCode: "ROLE_ADMIN" },
      { roleName: "IT Manager", roleCode: "ROLE_IT_MANAGER" },
      { roleName: "IT Agent", roleCode: "ROLE_IT_AGENT" },
      { roleName: "End User", roleCode: "ROLE_ENDUSER" },
      { roleName: "Service Desk", roleCode: "ROLE_SDESK" },
    ];

    for (const role of roles) {
      await queryRunner.query(
        `
        INSERT INTO "roles" ("role_name", "role_code", "description", "is_active", "created_at", "updated_at")
        VALUES ($1, $2, $3, $4, now(), now())
      `,
        [role.roleName, role.roleCode, `${role.roleName} role`, true]
      );
    }

    console.log("Seeding permissions...");
    const modules = [
      "Dashboard",
      "Incidents",
      "Service Requests",
      "Problems",
      "Changes",
      "Knowledge Base",
      "Assets",
      "Reports",
      "Admin",
    ];

    const permissionTypes = ["Read", "Create", "Update", "Delete", "Admin"];

    for (const module of modules) {
      for (const type of permissionTypes) {
        await queryRunner.query(
          `
          INSERT INTO "permissions" ("module_name", "permission_type", "description", "is_active", "created_at")
          VALUES ($1, $2, $3, $4, now())
        `,
          [module, type, `${type} access to ${module}`, true]
        );
      }
    }

    console.log("Seeding role-permission assignments...");
    // Administrator: all permissions
    const adminRoleId = (
      await queryRunner.query(
        `SELECT "role_id" FROM "roles" WHERE "role_code" = 'ROLE_ADMIN' LIMIT 1`
      )
    )[0].role_id;

    const allPermissions = await queryRunner.query(
      `SELECT "permission_id" FROM "permissions"`
    );

    for (const perm of allPermissions) {
      await queryRunner.query(
        `
        INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
        VALUES ($1, $2, now())
      `,
        [adminRoleId, perm.permission_id]
      );
    }

    // IT Manager: read, create, update on most modules (except Admin)
    const managerRoleId = (
      await queryRunner.query(
        `SELECT "role_id" FROM "roles" WHERE "role_code" = 'ROLE_IT_MANAGER' LIMIT 1`
      )
    )[0].role_id;

    const managerPermissions = await queryRunner.query(
      `
      SELECT "permission_id" FROM "permissions" 
      WHERE ("permission_type" IN ('Read', 'Create', 'Update') AND "module_name" != 'Admin')
         OR ("permission_type" = 'Read' AND "module_name" = 'Admin')
    `
    );

    for (const perm of managerPermissions) {
      await queryRunner.query(
        `
        INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
        VALUES ($1, $2, now())
      `,
        [managerRoleId, perm.permission_id]
      );
    }

    // IT Agent: read and create on Incidents and Service Requests, plus Dashboard read
    const agentRoleId = (
      await queryRunner.query(
        `SELECT "role_id" FROM "roles" WHERE "role_code" = 'ROLE_IT_AGENT' LIMIT 1`
      )
    )[0].role_id;

    const agentPermissions = await queryRunner.query(
      `
      SELECT "permission_id" FROM "permissions" 
      WHERE ("module_name" IN ('Incidents', 'Service Requests') AND "permission_type" IN ('Read', 'Create', 'Update'))
         OR ("module_name" = 'Dashboard' AND "permission_type" = 'Read')
    `
    );

    for (const perm of agentPermissions) {
      await queryRunner.query(
        `
        INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
        VALUES ($1, $2, now())
      `,
        [agentRoleId, perm.permission_id]
      );
    }

    // End User: read and create on Incidents and Service Requests
    const endUserRoleId = (
      await queryRunner.query(
        `SELECT "role_id" FROM "roles" WHERE "role_code" = 'ROLE_ENDUSER' LIMIT 1`
      )
    )[0].role_id;

    const endUserPermissions = await queryRunner.query(
      `
      SELECT "permission_id" FROM "permissions" 
      WHERE "module_name" IN ('Incidents', 'Service Requests') AND "permission_type" IN ('Read', 'Create')
    `
    );

    for (const perm of endUserPermissions) {
      await queryRunner.query(
        `
        INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
        VALUES ($1, $2, now())
      `,
        [endUserRoleId, perm.permission_id]
      );
    }

    // Service Desk: read and update on Incidents and Service Requests
    const sdeskRoleId = (
      await queryRunner.query(
        `SELECT "role_id" FROM "roles" WHERE "role_code" = 'ROLE_SDESK' LIMIT 1`
      )
    )[0].role_id;

    const sdeskPermissions = await queryRunner.query(
      `
      SELECT "permission_id" FROM "permissions" 
      WHERE "module_name" IN ('Incidents', 'Service Requests') AND "permission_type" IN ('Read', 'Update')
    `
    );

    for (const perm of sdeskPermissions) {
      await queryRunner.query(
        `
        INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
        VALUES ($1, $2, now())
      `,
        [sdeskRoleId, perm.permission_id]
      );
    }

    console.log("Roles and permissions seeded successfully!");
  } finally {
    await queryRunner.release();
  }
}
