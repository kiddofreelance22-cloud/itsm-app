import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Priority } from "./entities/priority.entity";
import { CreatePriorityDto, UpdatePriorityDto } from "./dto/priority.dto";
@Injectable()
export class PriorityService {
  constructor(@InjectRepository(Priority) private repo: Repository<Priority>) {}
  async create(dto: CreatePriorityDto): Promise<Priority> {
    const exists = await this.repo.findOne({ where: { priorityCode: dto.priorityCode } });
    if (exists) throw new ConflictException(`Code "${dto.priorityCode}" already exists`);
    return this.repo.save(this.repo.create(dto));
  }
  findAll(): Promise<Priority[]> { return this.repo.find({ order: { order: "ASC" } }); }
  async findOne(id: number): Promise<Priority> {
    const e = await this.repo.findOne({ where: { priorityId: id } });
    if (!e) throw new NotFoundException(`Priority ${id} not found`);
    return e;
  }
  async update(id: number, dto: UpdatePriorityDto): Promise<Priority> {
    const e = await this.findOne(id); Object.assign(e, dto); return this.repo.save(e);
  }
  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.repo.remove(e);
  }
}
