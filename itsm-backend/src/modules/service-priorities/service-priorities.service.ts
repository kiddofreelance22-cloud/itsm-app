import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { uniqueCode } from "../../common/utils/code.util";
import { ServicePriority } from "./entities/service-priority.entity";
import { CreateServicePriorityDto, UpdateServicePriorityDto } from "./dto/service-priority.dto";

@Injectable()
export class ServicePrioritiesService {
  constructor(@InjectRepository(ServicePriority) private readonly repo: Repository<ServicePriority>) {}

  async create(dto: CreateServicePriorityDto): Promise<ServicePriority> {
    const priorityName = dto.priorityName.trim();
    if (!priorityName) throw new ConflictException("Give the priority a name");
    if (await this.repo.findOne({ where: { priorityName: ILike(priorityName) } })) {
      throw new ConflictException(`Service priority "${priorityName}" already exists`);
    }
    if (!dto.priorityCode?.trim()) dto.priorityCode = await uniqueCode(this.repo, "priorityCode", priorityName);
    if (await this.repo.findOne({ where: { priorityCode: dto.priorityCode } })) {
      throw new ConflictException(`Code "${dto.priorityCode}" already exists`);
    }
    return this.repo.save(this.repo.create({ ...dto, priorityName }));
  }

  findAll(): Promise<ServicePriority[]> { return this.repo.find({ order: { order: "ASC", priorityName: "ASC" } }); }

  async findOne(id: number): Promise<ServicePriority> {
    const item = await this.repo.findOne({ where: { priorityId: id } });
    if (!item) throw new NotFoundException(`Service priority ${id} not found`);
    return item;
  }

  async update(id: number, dto: UpdateServicePriorityDto): Promise<ServicePriority> {
    const item = await this.findOne(id);
    if (dto.priorityName !== undefined) {
      const name = dto.priorityName.trim();
      const conflict = await this.repo.findOne({ where: { priorityName: ILike(name) } });
      if (conflict && conflict.priorityId !== id) throw new ConflictException(`Service priority "${name}" already exists`);
      dto.priorityName = name;
    }
    if (dto.priorityCode && dto.priorityCode !== item.priorityCode) {
      const conflict = await this.repo.findOne({ where: { priorityCode: dto.priorityCode } });
      if (conflict && conflict.priorityId !== id) throw new ConflictException(`Code "${dto.priorityCode}" already exists`);
    }
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    try {
      await this.repo.remove(item);
    } catch (err) {
      // 23503: still used by the request priority matrix. Requests and catalog items just lose the link.
      if ((err as { code?: string })?.code === "23503") {
        throw new ConflictException(`"${item.priorityName}" is used in the request priority matrix. Remove it there first, or mark it inactive instead.`);
      }
      throw err;
    }
  }
}
