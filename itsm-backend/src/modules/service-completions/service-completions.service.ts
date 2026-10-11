import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { ServiceCompletion } from "./entities/service-completion.entity";
import { CreateServiceCompletionDto, UpdateServiceCompletionDto } from "./dto/service-completion.dto";

@Injectable()
export class ServiceCompletionsService {
  constructor(@InjectRepository(ServiceCompletion) private readonly repo: Repository<ServiceCompletion>) {}
  async create(dto: CreateServiceCompletionDto) {
    const completionName = dto.completionName.trim();
    if (await this.repo.findOne({ where: { completionName: ILike(completionName) } })) throw new ConflictException(`Service completion "${completionName}" already exists`);
    return this.repo.save(this.repo.create({ ...dto, completionName }));
  }
  findAll() { return this.repo.find({ order: { sortOrder: "ASC", completionName: "ASC" } }); }
  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { serviceCompletionId: id } });
    if (!item) throw new NotFoundException(`Service completion ${id} not found`);
    return item;
  }
  async update(id: number, dto: UpdateServiceCompletionDto) {
    const item = await this.findOne(id);
    if (dto.completionName) {
      const completionName = dto.completionName.trim();
      const conflict = await this.repo.findOne({ where: { completionName: ILike(completionName) } });
      if (conflict && conflict.serviceCompletionId !== id) throw new ConflictException(`Service completion "${completionName}" already exists`);
      dto.completionName = completionName;
    }
    Object.assign(item, dto);
    return this.repo.save(item);
  }
  async remove(id: number) { await this.repo.remove(await this.findOne(id)); }
}