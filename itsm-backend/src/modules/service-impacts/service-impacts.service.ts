import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { ServiceImpact } from "./entities/service-impact.entity";
import { CreateServiceImpactDto, UpdateServiceImpactDto } from "./dto/service-impact.dto";

@Injectable()
export class ServiceImpactsService {
  constructor(@InjectRepository(ServiceImpact) private readonly repo: Repository<ServiceImpact>) {}
  async create(dto: CreateServiceImpactDto) {
    const impactName = dto.impactName.trim();
    if (await this.repo.findOne({ where: { impactName: ILike(impactName) } })) throw new ConflictException(`Service impact "${impactName}" already exists`);
    return this.repo.save(this.repo.create({ ...dto, impactName }));
  }
  findAll() { return this.repo.find({ order: { sortOrder: "ASC", impactName: "ASC" } }); }
  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { serviceImpactId: id } });
    if (!item) throw new NotFoundException(`Service impact ${id} not found`);
    return item;
  }
  async update(id: number, dto: UpdateServiceImpactDto) {
    const item = await this.findOne(id);
    if (dto.impactName) {
      const impactName = dto.impactName.trim();
      const conflict = await this.repo.findOne({ where: { impactName: ILike(impactName) } });
      if (conflict && conflict.serviceImpactId !== id) throw new ConflictException(`Service impact "${impactName}" already exists`);
      dto.impactName = impactName;
    }
    Object.assign(item, dto);
    return this.repo.save(item);
  }
  async remove(id: number) { await this.repo.remove(await this.findOne(id)); }
}