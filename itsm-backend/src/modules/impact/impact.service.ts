import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Impact } from "./entities/impact.entity";
import { CreateImpactDto, UpdateImpactDto } from "./dto/impact.dto";
@Injectable()
export class ImpactService {
  constructor(@InjectRepository(Impact) private repo: Repository<Impact>) {}
  async create(dto: CreateImpactDto): Promise<Impact> {
    const exists = await this.repo.findOne({ where: { impactCode: dto.impactCode } });
    if (exists) throw new ConflictException(`Code "${dto.impactCode}" already exists`);
    return this.repo.save(this.repo.create(dto));
  }
  findAll(): Promise<Impact[]> { return this.repo.find({ order: { order: "ASC" } }); }
  async findOne(id: number): Promise<Impact> {
    const e = await this.repo.findOne({ where: { impactId: id } });
    if (!e) throw new NotFoundException(`Impact ${id} not found`);
    return e;
  }
  async update(id: number, dto: UpdateImpactDto): Promise<Impact> {
    const e = await this.findOne(id); Object.assign(e, dto); return this.repo.save(e);
  }
  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.repo.remove(e);
  }
}
