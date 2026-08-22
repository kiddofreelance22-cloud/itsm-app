import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Reads the @Roles(...) metadata on the route handler and compares it against
 * request.user.roles (populated by JwtStrategy.validate()).
 * Must run AFTER JwtAuthGuard: @UseGuards(JwtAuthGuard, RolesGuard)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator on this route -> no role restriction
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !Array.isArray(user.roles)) {
      return false;
    }

    const normalize = (role: string) =>
      role === "Administrator" ? "Admin" : role;

    const userRoles = user.roles.map(normalize);
    
    // Expand "Fulfiller" to actual IT roles
    const expandedRequired = requiredRoles.flatMap((role) => {
      const normalized = normalize(role);
      if (normalized === "Fulfiller") {
        return ["IT Agent", "IT Manager", "Service Desk", "Admin"];
      }
      return [normalized];
    });

    return expandedRequired.some((role) => userRoles.includes(role));
  }
}
