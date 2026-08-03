import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Status } from "./entities/status.entity";
import { CreateStatusDto, UpdateStatusDto } from "./dto/status.dto";

@Injectable()
export class StatusService {
  constructor(@InjectRepository(Status) private repo: Repository<Status>) {}

  async create(dto: CreateStatusDto): Promise<Status> {
    const exists = await this.repo.findOne({ where: { statusCode: dto.statusCode } });
    if (exists) throw new ConflictException(`Status code "${dto.statusCode}" already exists`);
    return this.repo.save(this.repo.create(dto));
  }

  findAll(): Promise<Status[]> {
    return this.repo.find({ order: { statusId: "ASC" } });
  }

  async findOne(id: number): Promise<Status> {
    const s = await this.repo.findOne({ where: { statusId: id } });
    if (!s) throw new NotFoundException(`Status ${id} not found`);
    return s;
  }

  async update(id: number, dto: UpdateStatusDto): Promise<Status> {
    const s = await this.findOne(id);
    Object.assign(s, dto);
    return this.repo.save(s);
  }

  async remove(id: number): Promise<void> {
    const s = await this.findOne(id);
    await this.repo.remove(s);
  }
}
