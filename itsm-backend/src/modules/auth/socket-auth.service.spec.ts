import { JwtService } from "@nestjs/jwt";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { RolesService } from "../roles/roles.service";
import { SocketAuthService } from "./socket-auth.service";

describe("SocketAuthService", () => {
  const setup = () => {
    const jwt = { verifyAsync: jest.fn() } as unknown as jest.Mocked<JwtService>;
    const users = { findOne: jest.fn() } as unknown as jest.Mocked<Repository<User>>;
    const roles = { getRoleNamesForUser: jest.fn() } as unknown as jest.Mocked<RolesService>;
    return { service: new SocketAuthService(jwt, users, roles), jwt, users, roles };
  };

  it("authenticates a token against an active user and current roles", async () => {
    const { service, jwt, users, roles } = setup();
    jwt.verifyAsync.mockResolvedValue({ sub: 7, username: "outdated-token-name" });
    users.findOne.mockResolvedValue({ userId: 7, username: "current-name", isActive: true } as User);
    roles.getRoleNamesForUser.mockResolvedValue(["Administrator", "IT Agent"]);

    await expect(service.authenticate("signed-token")).resolves.toEqual({
      userId: 7, username: "current-name", roles: ["Admin", "IT Agent"],
    });
  });

  it("rejects missing, invalid, malformed and inactive-user credentials", async () => {
    const { service, jwt, users } = setup();
    await expect(service.authenticate()).resolves.toBeNull();
    expect(jwt.verifyAsync).not.toHaveBeenCalled();

    const invalidToken = new Error("invalid signature");
    invalidToken.name = "JsonWebTokenError";
    jwt.verifyAsync.mockRejectedValue(invalidToken);
    await expect(service.authenticate("invalid")).resolves.toBeNull();

    jwt.verifyAsync.mockResolvedValue({ sub: 0 });
    await expect(service.authenticate("malformed-subject")).resolves.toBeNull();

    jwt.verifyAsync.mockResolvedValue({ sub: 7 });
    users.findOne.mockResolvedValue(null);
    await expect(service.authenticate("inactive-user")).resolves.toBeNull();
  });
});
