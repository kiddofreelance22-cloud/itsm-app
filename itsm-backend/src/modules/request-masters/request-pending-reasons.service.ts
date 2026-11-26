import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { RequestPendingReason } from "./entities/request-pending-reason.entity";
import { CreateRequestPendingReasonDto, UpdateRequestPendingReasonDto } from "./dto/request-pending-reason.dto";

@Injectable()
export class RequestPendingReasonsService {
  constructor(@InjectRepository(RequestPendingReason) private readonly repo: Repository<RequestPendingReason>) {}

  private async assertUnique(name: string, ignoreId?: number) {
    const found = await this.repo.findOne({ where: { pendingReasonName: ILike(name) } });
    if (found && found.pendingReasonId !== ignoreId) throw new ConflictException(`Pending reason "${name}" already exists`);
  }

  async create(dto: CreateRequestPendingReasonDto) {
    const name = dto.pendingReasonName.trim();
    await this.assertUnique(name);
    return this.repo.save(this.repo.create({ ...dto, pendingReasonName: name }));
  }
  list() { return this.repo.find({ order: { displayOrder: "ASC", pendingReasonName: "ASC" } }); }
  async findOne(id: number) {
    const item = await this.repo.findOneBy({ pendingReasonId: id });
    if (!item) throw new NotFoundException(`Pending reason ${id} not found`);
    return item;
  }
  async update(id: number, dto: UpdateRequestPendingReasonDto) {
    const item = await this.findOne(id);
    if (dto.pendingReasonName !== undefined) {
      dto.pendingReasonName = dto.pendingReasonName.trim();
      await this.assertUnique(dto.pendingReasonName, id);
    }
    Object.assign(item, dto);
    return this.repo.save(item);
  }
  async remove(id: number) { await this.repo.remove(await this.findOne(id)); }
}
