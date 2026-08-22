import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Task } from "./entities/task.entity";
import { User } from "../users/entities/user.entity";
import { Incident } from "../incidents/entities/incident.entity";
import { CreateTaskDto, UpdateTaskDto } from "./dto/task.dto";

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private repo: Repository<Task>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Incident) private incidentRepo: Repository<Incident>,
  ) {}

  private async genCode(): Promise<string> {
    const last = await this.repo.findOne({ where: {}, order: { taskId: "DESC" } });
    const n = last ? last.taskId + 1 : 1;
    return `TASK${String(n).padStart(9, "0")}`;
  }

  async create(dto: CreateTaskDto): Promise<Task> {
    const task = this.repo.create({
      taskCode: await this.genCode(),
      shortDescription: dto.shortDescription,
      description: dto.description,
      taskType: (dto.taskType as any) ?? "Investigation",
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    if (dto.assignedToId) {
      task.assignedTo = await this.userRepo.findOne({ where: { userId: dto.assignedToId } }) ?? undefined;
    }
    if (dto.incidentId) {
      task.incident = await this.incidentRepo.findOne({ where: { incidentId: dto.incidentId } }) ?? undefined;
    }

    return this.repo.save(task);
  }

  findAllForIncident(incidentId: string): Promise<Task[]> {
    return this.repo.find({
      where: { incident: { incidentId } },
      relations: { assignedTo: true },
      order: { createdAt: "ASC" },
    });
  }

  findAll(): Promise<Task[]> {
    return this.repo.find({ relations: { assignedTo: true, incident: true }, order: { createdAt: "DESC" } });
  }

  async findOne(taskId: number): Promise<Task> {
    const t = await this.repo.findOne({ where: { taskId }, relations: { assignedTo: true, incident: true } });
    if (!t) throw new NotFoundException(`Task ${taskId} not found`);
    return t;
  }

  async update(taskId: number, dto: UpdateTaskDto): Promise<Task> {
    const t = await this.findOne(taskId);
    if (dto.assignedToId !== undefined)
      t.assignedTo = dto.assignedToId ? await this.userRepo.findOne({ where: { userId: dto.assignedToId } }) ?? undefined : undefined;
    const { assignedToId, ...rest } = dto;
    Object.assign(t, rest);
    return this.repo.save(t);
  }

  async remove(taskId: number): Promise<void> {
    const t = await this.findOne(taskId);
    await this.repo.remove(t);
  }
}
