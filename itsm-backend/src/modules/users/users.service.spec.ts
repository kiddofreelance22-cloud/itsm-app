import { UsersService } from "./users.service";

describe("UsersService", () => {
  it("assigns a default role when creating a new user", async () => {
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation(async (user) => ({ ...user, userId: 42 })),
    };

    const rolesRepo = {
      findOne: jest.fn().mockResolvedValue({ roleId: 4, roleCode: "ROLE_ENDUSER" }),
    };

    const userRolesRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockResolvedValue({}),
    };

    const mailService = {
      sendFirstTimeLoginEmail: jest.fn().mockResolvedValue(undefined),
    };

    const service = new UsersService(
      usersRepo as any,
      rolesRepo as any,
      userRolesRepo as any,
      mailService as any,
    );

    await service.create({
      username: "newuser",
      email: "newuser@example.com",
      fullName: "New User",
      password: "Password123!",
    } as any);

    expect(userRolesRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ userId: 42 }),
        role: expect.objectContaining({ roleId: 4 }),
      }),
    );
    expect(userRolesRepo.save).toHaveBeenCalled();
  });
});
