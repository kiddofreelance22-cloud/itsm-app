import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * Usage: @Roles('Admin', 'Approver')
 * Attach above a controller method (after @UseGuards(JwtAuthGuard, RolesGuard))
 * to restrict access to users holding at least one of the given roles.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
