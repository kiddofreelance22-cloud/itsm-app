import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Problem } from "./entities/problem.entity";
import { User } from "../users/entities/user.entity";
import { CreateProblemDto, UpdateProblemDto } from "./dto/problem.dto";

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem) private repo: Repository<Problem>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  private async genCode(): Promise<string> {
    const last = await this.repo.findOne({ where: {}, order: { problemId: "DESC" } });
    const n = last ? last.problemId + 1 : 1;
    return `PRB${String(n).padStart(9, "0")}`;
  }

  async create(dto: CreateProblemDto): Promise<Problem> {
    const problem = this.repo.create({
      problemCode: await this.genCode(),
      shortDescription: dto.shortDescription,
      description: dto.description,
    });
    if (dto.assignedToId) {
      problem.assignedTo = await this.userRepo.findOne({ where: { userId: dto.assignedToId } }) ?? undefined;
    }
    return this.repo.save(problem);
  }

  findAll(): Promise<Problem[]> {
    return this.repo.find({ relations: { assignedTo: true }, order: { createdAt: "DESC" } });
  }

  async findOne(problemId: number): Promise<Problem> {
    const p = await this.repo.findOne({ where: { problemId }, relations: { assignedTo: true } });
    if (!p) throw new NotFoundException(`Problem ${problemId} not found`);
    return p;
  }

  async update(problemId: number, dto: UpdateProblemDto): Promise<Problem> {
    const p = await this.findOne(problemId);
    if (dto.assignedToId !== undefined) {
      p.assignedTo = dto.assignedToId ? await this.userRepo.findOne({ where: { userId: dto.assignedToId } }) ?? undefined : undefined;
    }
    const wasResolved = p.status === "Resolved" || p.status === "Closed";
    const { assignedToId, ...rest } = dto;
    Object.assign(p, rest);
    const nowResolved = p.status === "Resolved" || p.status === "Closed";
    if (!wasResolved && nowResolved && !p.resolvedAt) {
      p.resolvedAt = new Date();
    }
    return this.repo.save(p);
  }

  async remove(problemId: number): Promise<void> {
    const p = await this.findOne(problemId);
    await this.repo.remove(p);
  }
}
