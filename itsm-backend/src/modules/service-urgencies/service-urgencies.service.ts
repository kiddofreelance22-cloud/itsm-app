import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { uniqueCode } from "../../common/utils/code.util";
import { ServiceUrgency } from "./entities/service-urgency.entity";
import { CreateServiceUrgencyDto, UpdateServiceUrgencyDto } from "./dto/service-urgency.dto";

@Injectable()
export class ServiceUrgenciesService {
  constructor(@InjectRepository(ServiceUrgency) private readonly repo: Repository<ServiceUrgency>) {}

  async create(dto: CreateServiceUrgencyDto): Promise<ServiceUrgency> {
    const urgencyName = dto.urgencyName.trim();
    if (!urgencyName) throw new ConflictException("Give the urgency a name");
    if (await this.repo.findOne({ where: { urgencyName: ILike(urgencyName) } })) {
      throw new ConflictException(`Service urgency "${urgencyName}" already exists`);
    }
    if (!dto.urgencyCode?.trim()) dto.urgencyCode = await uniqueCode(this.repo, "urgencyCode", urgencyName);
    if (await this.repo.findOne({ where: { urgencyCode: dto.urgencyCode } })) {
      throw new ConflictException(`Code "${dto.urgencyCode}" already exists`);
    }
    return this.repo.save(this.repo.create({ ...dto, urgencyName }));
  }

  findAll(): Promise<ServiceUrgency[]> {
    return this.repo.find({ order: { order: "ASC", urgencyName: "ASC" } });
  }

  async findOne(id: number): Promise<ServiceUrgency> {
    const item = await this.repo.findOne({ where: { urgencyId: id } });
    if (!item) throw new NotFoundException(`Service urgency ${id} not found`);
    return item;
  }

  async update(id: number, dto: UpdateServiceUrgencyDto): Promise<ServiceUrgency> {
    const item = await this.findOne(id);
    if (dto.urgencyName !== undefined) {
      const name = dto.urgencyName.trim();
      const conflict = await this.repo.findOne({ where: { urgencyName: ILike(name) } });
      if (conflict && conflict.urgencyId !== id) throw new ConflictException(`Service urgency "${name}" already exists`);
      dto.urgencyName = name;
    }
    if (dto.urgencyCode && dto.urgencyCode !== item.urgencyCode) {
      const conflict = await this.repo.findOne({ where: { urgencyCode: dto.urgencyCode } });
      if (conflict && conflict.urgencyId !== id) throw new ConflictException(`Code "${dto.urgencyCode}" already exists`);
    }
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    try {
      await this.repo.remove(item);
    } catch (err) {
      // 23503: referenced by request_priority_matrices, catalogs or requests
      if ((err as { code?: string })?.code === "23503") {
        throw new ConflictException(`"${item.urgencyName}" is used in the request priority matrix. Remove it there first, or mark it inactive instead.`);
      }
      throw err;
    }
  }
}
