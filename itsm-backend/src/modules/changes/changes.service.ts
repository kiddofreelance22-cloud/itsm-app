import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Change } from "./entities/change.entity";
import { User } from "../users/entities/user.entity";
import { CreateChangeDto, UpdateChangeDto } from "./dto/change.dto";

@Injectable()
export class ChangesService {
  constructor(
    @InjectRepository(Change) private repo: Repository<Change>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  private async genCode(): Promise<string> {
    const last = await this.repo.findOne({ where: {}, order: { changeId: "DESC" } });
    const n = last ? last.changeId + 1 : 1;
    return `CHG${String(n).padStart(9, "0")}`;
  }

  async create(dto: CreateChangeDto): Promise<Change> {
    const change = this.repo.create({
      changeCode: await this.genCode(),
      shortDescription: dto.shortDescription,
      description: dto.description,
    });
    if (dto.assignedToId) {
      change.assignedTo = await this.userRepo.findOne({ where: { userId: dto.assignedToId } }) ?? undefined;
    }
    return this.repo.save(change);
  }

  findAll(): Promise<Change[]> {
    return this.repo.find({ relations: { assignedTo: true }, order: { createdAt: "DESC" } });
  }

  async findOne(changeId: number): Promise<Change> {
    const c = await this.repo.findOne({ where: { changeId }, relations: { assignedTo: true } });
    if (!c) throw new NotFoundException(`Change ${changeId} not found`);
    return c;
  }

  async update(changeId: number, dto: UpdateChangeDto): Promise<Change> {
    const c = await this.findOne(changeId);
    if (dto.assignedToId !== undefined) {
      c.assignedTo = dto.assignedToId ? await this.userRepo.findOne({ where: { userId: dto.assignedToId } }) ?? undefined : undefined;
    }
    const wasCompleted = c.status === "Completed" || c.status === "Cancelled";
    const { assignedToId, ...rest } = dto;
    Object.assign(c, rest);
    const nowCompleted = c.status === "Completed" || c.status === "Cancelled";
    if (!wasCompleted && nowCompleted && !c.completedAt) {
      c.completedAt = new Date();
    }
    return this.repo.save(c);
  }

  async remove(changeId: number): Promise<void> {
    const c = await this.findOne(changeId);
    await this.repo.remove(c);
  }
}
