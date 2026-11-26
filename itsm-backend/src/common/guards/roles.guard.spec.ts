import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  const createContext = (roles: string[]): ExecutionContext => ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { roles } }),
    }),
  } as unknown as ExecutionContext);

  it.each(["Admin", "ADMIN", "admin", "Administrator", "ADMINISTRATOR"])(
    "recognizes administrator role %s",
    (role) => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(["Admin"]),
      } as unknown as Reflector;

      expect(new RolesGuard(reflector).canActivate(createContext([role]))).toBe(true);
    },
  );

  it("does not grant admin access to an unrelated role", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["Admin"]),
    } as unknown as Reflector;

    expect(new RolesGuard(reflector).canActivate(createContext(["IT Agent"]))).toBe(false);
  });

  it("allows routes without role metadata", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    expect(new RolesGuard(reflector).canActivate(createContext(["End User"]))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });
});
