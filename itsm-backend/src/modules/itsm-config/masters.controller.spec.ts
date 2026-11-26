import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { WoChecklistItemsController } from "./masters.controller";
import { WoChecklistItemDto } from "./dto/itsm-config.dto";

describe("WoChecklistItemsController", () => {
  it("accepts and persists the required flag on create and update", async () => {
    const row = { id: 1, name: "Confirm affected CI", isRequired: false };
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      findOne: jest.fn(async () => row),
    };
    const controller = new WoChecklistItemsController(repository as never);
    const dto = plainToInstance(WoChecklistItemDto, { name: row.name, isRequired: true });

    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    await controller.create(dto);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ isRequired: true }));

    await controller.update(1, { isRequired: false });
    expect(row.isRequired).toBe(false);
    expect(repository.save).toHaveBeenLastCalledWith(row);
  });
});
