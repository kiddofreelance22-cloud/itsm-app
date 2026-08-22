import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import { Priority } from "./entities/priority.entity";
import { CreatePriorityDto, UpdatePriorityDto } from "./dto/priority.dto";
@Injectable()
export class PriorityService {
  constructor(@InjectRepository(Priority) private repo: Repository<Priority>) {}
  async create(dto: CreatePriorityDto): Promise<Priority> {
    const priorityName = dto.priorityName.trim();
    // Name must be unique (case-insensitive) even if a different code is entered
    const nameConflict = await this.repo.findOne({ where: { priorityName: ILike(priorityName) } });
    if (nameConflict) throw new ConflictException(`Priority "${priorityName}" already exists`);
    const exists = await this.repo.findOne({ where: { priorityCode: dto.priorityCode } });
    if (exists) throw new ConflictException(`Code "${dto.priorityCode}" already exists`);
    return this.repo.save(this.repo.create({ ...dto, priorityName }));
  }
  findAll(): Promise<Priority[]> { return this.repo.find({ order: { order: "ASC" } }); }
  async findOne(id: number): Promise<Priority> {
    const e = await this.repo.findOne({ where: { priorityId: id } });
    if (!e) throw new NotFoundException(`Priority ${id} not found`);
    return e;
  }
  async update(id: number, dto: UpdatePriorityDto): Promise<Priority> {
    const e = await this.findOne(id);
    if (dto.priorityName && dto.priorityName.trim().toLowerCase() !== e.priorityName.toLowerCase()) {
      const conflict = await this.repo.findOne({ where: { priorityName: ILike(dto.priorityName.trim()) } });
      if (conflict && conflict.priorityId !== id) throw new ConflictException(`Priority "${dto.priorityName.trim()}" already exists`);
      dto.priorityName = dto.priorityName.trim();
    }
    if (dto.priorityCode && dto.priorityCode !== e.priorityCode) {
      const conflict = await this.repo.findOne({ where: { priorityCode: dto.priorityCode } });
      if (conflict && conflict.priorityId !== id) throw new ConflictException(`Code "${dto.priorityCode}" already exists`);
    }
    Object.assign(e, dto); return this.repo.save(e);
  }
  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.repo.remove(e);
  }
}
