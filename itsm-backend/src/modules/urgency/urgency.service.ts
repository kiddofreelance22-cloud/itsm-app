import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Urgency } from "./entities/urgency.entity";
import { CreateUrgencyDto, UpdateUrgencyDto } from "./dto/urgency.dto";
@Injectable()
export class UrgencyService {
  constructor(@InjectRepository(Urgency) private repo: Repository<Urgency>) {}
  async create(dto: CreateUrgencyDto): Promise<Urgency> {
    const exists = await this.repo.findOne({ where: { urgencyCode: dto.urgencyCode } });
    if (exists) throw new ConflictException(`Code "${dto.urgencyCode}" already exists`);
    return this.repo.save(this.repo.create(dto));
  }
  findAll(): Promise<Urgency[]> { return this.repo.find({ order: { order: "ASC" } }); }
  async findOne(id: number): Promise<Urgency> {
    const e = await this.repo.findOne({ where: { urgencyId: id } });
    if (!e) throw new NotFoundException(`Urgency ${id} not found`);
    return e;
  }
  async update(id: number, dto: UpdateUrgencyDto): Promise<Urgency> {
    const e = await this.findOne(id); Object.assign(e, dto); return this.repo.save(e);
  }
  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.repo.remove(e);
  }
}
