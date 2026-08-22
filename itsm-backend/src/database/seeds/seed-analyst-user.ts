import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "../../modules/users/entities/user.entity";
import { Role } from "../../modules/roles/entities/role.entity";
import { UserRole } from "../../modules/roles/entities/user-role.entity";

/**
 * Creates a default Analyst user (if one doesn't already exist) and assigns
 * the "IT Agent" role to it. Requires seedRoles() to have run first.
 * Credentials can be overridden via env vars; otherwise sensible defaults are used.
 */
export async function seedAnalystUser(dataSource: DataSource): Promise<void> {
  const userRepository = dataSource.getRepository(User);
  const roleRepository = dataSource.getRepository(Role);
  const userRoleRepository = dataSource.getRepository(UserRole);

  const analystUsername = process.env.ANALYST_USERNAME || "analyst";
  const analystEmail = process.env.ANALYST_EMAIL || "analyst@itsm.local";
  const analystPassword = process.env.ANALYST_PASSWORD || "Analyst@12345";
  const analystFullName = process.env.ANALYST_FULL_NAME || "IT Analyst";

  // Find the IT Agent role
  const agentRole = await roleRepository.findOne({
    where: [
      { roleCode: "ROLE_IT_AGENT" },
      { roleName: "IT Agent" },
    ],
  });

  if (!agentRole) {
    throw new Error(
      'IT Agent role not found (searched ROLE_IT_AGENT, "IT Agent"). Run seedRoles() before seedAnalystUser().',
    );
  }

  let analystUser = await userRepository.findOne({
    where: { username: analystUsername },
  });

  if (analystUser) {
    console.log(`  - Analyst user "${analystUsername}" already exists, skipping creation.`);
  } else {
    const passwordHash = await bcrypt.hash(analystPassword, 10);

    analystUser = userRepository.create({
      username: analystUsername,
      email: analystEmail,
      passwordHash,
      fullName: analystFullName,
      isActive: true,
    });

    analystUser = await userRepository.save(analystUser);
    console.log(`  - Created analyst user "${analystUsername}" (${analystEmail}).`);

    if (!process.env.ANALYST_PASSWORD) {
      console.log(
        `  - NOTE: using default analyst password "${analystPassword}". Set ANALYST_PASSWORD env var to override.`,
      );
    }
  }

  const existingAssignment = await userRoleRepository.findOne({
    where: {
      user: { userId: analystUser.userId },
      role: { roleId: agentRole.roleId },
    },
    relations: ["user", "role"],
  });

  if (existingAssignment) {
    console.log(`  - Analyst user already has the "IT Agent" role, skipping assignment.`);
    return;
  }

  const userRole = userRoleRepository.create({
    user: analystUser,
    role: agentRole,
  });

  await userRoleRepository.save(userRole);
  console.log(`  - Assigned "IT Agent" role to "${analystUsername}".`);
}
