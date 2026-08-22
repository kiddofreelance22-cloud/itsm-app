import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import { Urgency } from "./entities/urgency.entity";
import { CreateUrgencyDto, UpdateUrgencyDto } from "./dto/urgency.dto";
@Injectable()
export class UrgencyService {
  constructor(@InjectRepository(Urgency) private repo: Repository<Urgency>) {}
  async create(dto: CreateUrgencyDto): Promise<Urgency> {
    const urgencyName = dto.urgencyName.trim();
    // Name must be unique (case-insensitive) even if a different code is entered
    const nameConflict = await this.repo.findOne({ where: { urgencyName: ILike(urgencyName) } });
    if (nameConflict) throw new ConflictException(`Urgency "${urgencyName}" already exists`);
    const exists = await this.repo.findOne({ where: { urgencyCode: dto.urgencyCode } });
    if (exists) throw new ConflictException(`Code "${dto.urgencyCode}" already exists`);
    return this.repo.save(this.repo.create({ ...dto, urgencyName }));
  }
  findAll(): Promise<Urgency[]> { return this.repo.find({ order: { order: "ASC" } }); }
  async findOne(id: number): Promise<Urgency> {
    const e = await this.repo.findOne({ where: { urgencyId: id } });
    if (!e) throw new NotFoundException(`Urgency ${id} not found`);
    return e;
  }
  async update(id: number, dto: UpdateUrgencyDto): Promise<Urgency> {
    const e = await this.findOne(id);
    if (dto.urgencyName && dto.urgencyName.trim().toLowerCase() !== e.urgencyName.toLowerCase()) {
      const conflict = await this.repo.findOne({ where: { urgencyName: ILike(dto.urgencyName.trim()) } });
      if (conflict && conflict.urgencyId !== id) throw new ConflictException(`Urgency "${dto.urgencyName.trim()}" already exists`);
      dto.urgencyName = dto.urgencyName.trim();
    }
    if (dto.urgencyCode && dto.urgencyCode !== e.urgencyCode) {
      const conflict = await this.repo.findOne({ where: { urgencyCode: dto.urgencyCode } });
      if (conflict && conflict.urgencyId !== id) throw new ConflictException(`Code "${dto.urgencyCode}" already exists`);
    }
    Object.assign(e, dto); return this.repo.save(e);
  }
  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.repo.remove(e);
  }
}
