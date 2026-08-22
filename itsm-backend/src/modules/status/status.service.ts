import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import { Status } from "./entities/status.entity";
import { CreateStatusDto, UpdateStatusDto } from "./dto/status.dto";

@Injectable()
export class StatusService {
  constructor(@InjectRepository(Status) private repo: Repository<Status>) {}

  async create(dto: CreateStatusDto): Promise<Status> {
    const statusName = dto.statusName.trim();
    // Name must be unique (case-insensitive, scoped per type) even if a different code is entered
    const nameConflict = await this.repo.findOne({ where: { statusName: ILike(statusName), type: dto.type ?? "incident" } });
    if (nameConflict) throw new ConflictException(`Status "${statusName}" already exists`);
    const exists = await this.repo.findOne({ where: { statusCode: dto.statusCode } });
    if (exists) throw new ConflictException(`Status code "${dto.statusCode}" already exists`);
    return this.repo.save(this.repo.create({ ...dto, statusName }));
  }

  findAll(): Promise<Status[]> {
    return this.repo.find({ order: { statusId: "ASC" } });
  }

  async findOne(id: number): Promise<Status> {
    const s = await this.repo.findOne({ where: { statusId: id } });
    if (!s) throw new NotFoundException(`Status ${id} not found`);
    return s;
  }

  async update(id: number, dto: UpdateStatusDto): Promise<Status> {
    const s = await this.findOne(id);
    const type = dto.type ?? s.type;
    if (dto.statusName && dto.statusName.trim().toLowerCase() !== s.statusName.toLowerCase()) {
      const conflict = await this.repo.findOne({ where: { statusName: ILike(dto.statusName.trim()), type } });
      if (conflict && conflict.statusId !== id) throw new ConflictException(`Status "${dto.statusName.trim()}" already exists`);
      dto.statusName = dto.statusName.trim();
    }
    if (dto.statusCode && dto.statusCode !== s.statusCode) {
      const conflict = await this.repo.findOne({ where: { statusCode: dto.statusCode } });
      if (conflict && conflict.statusId !== id) throw new ConflictException(`Status code "${dto.statusCode}" already exists`);
    }
    Object.assign(s, dto);
    return this.repo.save(s);
  }

  async remove(id: number): Promise<void> {
    const s = await this.findOne(id);
    await this.repo.remove(s);
  }
}
