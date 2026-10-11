import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { uniqueCode } from "../../common/utils/code.util";
import { Repository, ILike } from "typeorm";
import { Impact } from "./entities/impact.entity";
import { CreateImpactDto, UpdateImpactDto } from "./dto/impact.dto";
@Injectable()
export class ImpactService {
  constructor(@InjectRepository(Impact) private repo: Repository<Impact>) {}
  async create(dto: CreateImpactDto): Promise<Impact> {
    const impactName = dto.impactName.trim();
    // Name must be unique (case-insensitive) even if a different code is entered
    const nameConflict = await this.repo.findOne({ where: { impactName: ILike(impactName) } });
    if (nameConflict) throw new ConflictException(`Impact "${impactName}" already exists`);
    if (!dto.impactCode) dto.impactCode = await uniqueCode(this.repo, "impactCode", impactName);
    const exists = await this.repo.findOne({ where: { impactCode: dto.impactCode } });
    if (exists) throw new ConflictException(`Code "${dto.impactCode}" already exists`);
    return this.repo.save(this.repo.create({ ...dto, impactName }));
  }
  findAll(): Promise<Impact[]> { return this.repo.find({ order: { order: "ASC" } }); }
  async findOne(id: number): Promise<Impact> {
    const e = await this.repo.findOne({ where: { impactId: id } });
    if (!e) throw new NotFoundException(`Impact ${id} not found`);
    return e;
  }
  async update(id: number, dto: UpdateImpactDto): Promise<Impact> {
    const e = await this.findOne(id);
    if (dto.impactName && dto.impactName.trim().toLowerCase() !== e.impactName.toLowerCase()) {
      const conflict = await this.repo.findOne({ where: { impactName: ILike(dto.impactName.trim()) } });
      if (conflict && conflict.impactId !== id) throw new ConflictException(`Impact "${dto.impactName.trim()}" already exists`);
      dto.impactName = dto.impactName.trim();
    }
    if (dto.impactCode && dto.impactCode !== e.impactCode) {
      const conflict = await this.repo.findOne({ where: { impactCode: dto.impactCode } });
      if (conflict && conflict.impactId !== id) throw new ConflictException(`Code "${dto.impactCode}" already exists`);
    }
    Object.assign(e, dto); return this.repo.save(e);
  }
  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.repo.remove(e);
  }
}
