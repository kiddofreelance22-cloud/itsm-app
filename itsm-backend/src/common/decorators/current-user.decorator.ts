import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Usage: findMine(@CurrentUser() user: AuthenticatedUser) { ... }
 * Pulls the user object that JwtStrategy.validate() attached to the request.
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  }
);
