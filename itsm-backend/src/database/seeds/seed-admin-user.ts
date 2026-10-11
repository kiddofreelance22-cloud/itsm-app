import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "../../modules/users/entities/user.entity";
import { Role } from "../../modules/roles/entities/role.entity";
import { UserRole } from "../../modules/roles/entities/user-role.entity";

/**
 * Creates a default Admin user (if one doesn't already exist) and assigns
 * the "Admin" role to it. Requires seedRoles() to have run first so the
 * Admin role row exists. Credentials can be overridden via env vars;
 * otherwise sensible local-dev defaults are used.
 */
export async function seedAdminUser(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);
  const roleRepository = dataSource.getRepository(Role);
  const userRoleRepository = dataSource.getRepository(UserRole);

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@itsm.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@12345";
  const adminFullName = process.env.ADMIN_FULL_NAME || "System Administrator";

  // Try to find the Admin role by code first, then by common name variants.
  const adminRole = await roleRepository.findOne({
    where: [
      { roleCode: "ROLE_ADMIN" },
      { roleName: "Admin" },
      { roleName: "Administrator" },
    ],
  });

  if (!adminRole) {
    throw new Error(
      'Admin role not found (searched ROLE_ADMIN, "Admin", "Administrator"). Run seedRoles() before seedAdminUser().',
    );
  }

  let adminUser = await userRepository.findOne({
    where: { username: adminUsername },
  });

  if (adminUser) {
    console.log(`  - Admin user "${adminUsername}" already exists, skipping creation.`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    adminUser = userRepository.create({
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      fullName: adminFullName,
      primaryRole: adminRole,
      isActive: true,
    });

    adminUser = await userRepository.save(adminUser);
    console.log(`  - Created admin user "${adminUsername}" (${adminEmail}).`);

    if (!process.env.ADMIN_PASSWORD) {
      console.log(
        `  - NOTE: using default admin password "${adminPassword}". Set ADMIN_PASSWORD env var to override.`,
      );
    }
  }

  const existingAssignment = await userRoleRepository.findOne({
    where: {
      user: { userId: adminUser.userId },
      role: { roleId: adminRole.roleId },
    },
    relations: ["user", "role"],
  });

  if (existingAssignment) {
    console.log(`  - Admin user already has the "Admin" role, skipping assignment.`);
    return;
  }

  const userRole = userRoleRepository.create({
    user: adminUser,
    role: adminRole,
  });

  await userRoleRepository.save(userRole);
  console.log(`  - Assigned "Admin" role to "${adminUsername}".`);
}
