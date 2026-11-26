import { DirectoryService } from "./directory.service";
import { DirectorySource } from "./entities/directory-source.entity";
import { DirectoryAttributeMapping } from "./entities/directory-attribute-mapping.entity";

describe("DirectoryService attribute sync", () => {
  const createService = (overrides: Record<string, unknown> = {}) => {
    const repositories = {
      sources: {},
      mappings: {},
      runs: {},
      users: { findOne: jest.fn(), update: jest.fn() },
      roles: { findOne: jest.fn().mockResolvedValue(null) },
      userRoles: {},
      departments: { find: jest.fn().mockResolvedValue([]) },
      ...overrides,
    };
    const service = new DirectoryService(
      repositories.sources as any,
      repositories.mappings as any,
      repositories.runs as any,
      repositories.users as any,
      repositories.roles as any,
      repositories.userRoles as any,
      repositories.departments as any,
    );
    return { service, repositories };
  };

  it("requests and extracts Graph manager and array-valued phone attributes", async () => {
    const { service } = createService();
    (service as any).graphToken = jest.fn().mockResolvedValue("test-token");
    const fetch = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [{
          userPrincipalName: "kapil@example.com",
          mail: "kapil@example.com",
          displayName: "Kapil Sharma",
          businessPhones: ["+91 98765 43210"],
          manager: { displayName: "Abhishek Sharma" },
        }],
      }),
    } as Response);

    try {
      const entries = await (service as any).fetchGraph({} as DirectorySource, [
        { externalAttribute: "businessPhones" },
        { externalAttribute: "manager" },
      ] as DirectoryAttributeMapping[]);

      const requestUrl = new URL(fetch.mock.calls[0][0] as string);
      expect(requestUrl.searchParams.get("$expand")).toBe("manager($select=displayName)");
      expect(requestUrl.searchParams.get("$select")).not.toContain("manager");
      expect(entries[0].values).toMatchObject({
        businessPhones: "+91 98765 43210",
        manager: "Abhishek Sharma",
      });
    } finally {
      fetch.mockRestore();
    }
  });

  it("applies configured standard user fields and resolves department names", async () => {
    const existing = { userId: 7 };
    const { service, repositories } = createService({
      users: {
        findOne: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue(undefined),
      },
      departments: {
        find: jest.fn().mockResolvedValue([{ departmentId: 3, departmentName: "IT Support" }]),
      },
    });
    const mappings = [
      ["Full Name", "displayName"],
      ["First Name", "givenName"],
      ["Last Name", "surname"],
      ["City", "city"],
      ["Employee ID", "employeeId"],
      ["Manager", "manager"],
      ["Phone Number", "businessPhones"],
      ["Department", "department"],
    ].map(([localField, externalAttribute]) => ({ localField, externalAttribute })) as DirectoryAttributeMapping[];

    await (service as any).upsertUsers({ defaultRole: "End User" } as DirectorySource, mappings, [{
      username: "kapil",
      email: "kapil@example.com",
      values: {
        displayName: "Kapil Sharma",
        givenName: "Kapil",
        surname: "Sharma",
        city: "Mumbai",
        employeeId: "EMP12121",
        manager: "Abhishek Sharma",
        businessPhones: "+91 98765 43210",
        department: "IT Support",
      },
    }]);

    expect(repositories.users.update).toHaveBeenCalledWith(
      { userId: existing.userId },
      {
        fullName: "Kapil Sharma",
        displayName: "Kapil Sharma",
        firstName: "Kapil",
        lastName: "Sharma",
        city: "Mumbai",
        employeeId: "EMP12121",
        managerName: "Abhishek Sharma",
        phone: "+91 98765 43210",
        departmentId: 3,
      },
    );
  });
});
