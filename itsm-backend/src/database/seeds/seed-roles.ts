import { DataSource } from "typeorm";
import { Role } from "../../modules/roles/entities/role.entity";

/**
 * Default roles required for RBAC (guards + @Roles() decorator checks
 * throughout the app). Idempotent — safe to run multiple times.
 */
const DEFAULT_ROLES: Array<{ roleName: string; description: string }> = [
  {
    roleName: "Admin",
    description:
      "Full system access — manages users, roles, categories, catalogs, and workflows.",
  },
  {
    roleName: "Approver",
    description:
      "Reviews and approves/rejects requests routed to them via workflow steps.",
  },
  {
    roleName: "Requester",
    description: "Standard user who can submit service requests and log incidents.",
  },
  {
    roleName: "Agent",
    description: "Handles and resolves incidents assigned to them.",
  },
];

export async function seedRoles(dataSource: DataSource): Promise<void> {
  const roleRepository = dataSource.getRepository(Role);

  for (const roleData of DEFAULT_ROLES) {
    const existing = await roleRepository.findOne({
      where: { roleName: roleData.roleName },
    });

    if (existing) {
      console.log(`  - Role "${roleData.roleName}" already exists, skipping.`);
      continue;
    }

    const role = roleRepository.create({
      roleName: roleData.roleName,
      description: roleData.description,
      isActive: true,
    });

    await roleRepository.save(role);
    console.log(`  - Created role "${roleData.roleName}".`);
  }
}
