import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import { Status } from "./entities/status.entity";
import { StatusVersion } from "./entities/status-version.entity";
import { CreateStatusDto, UpdateStatusDto } from "./dto/status.dto";
import { uniqueCode } from "../../common/utils/code.util";

@Injectable()
export class StatusService {
  constructor(
    @InjectRepository(Status) private repo: Repository<Status>,
    @InjectRepository(StatusVersion) private versions: Repository<StatusVersion>,
  ) {}

  async create(dto: CreateStatusDto, actor = "System"): Promise<Status> {
    const statusName = dto.statusName.trim();
    // Name must be unique (case-insensitive, scoped per type) even if a different code is entered
    const nameConflict = await this.repo.findOne({ where: { statusName: ILike(statusName), type: dto.type ?? "incident" } });
    if (nameConflict) throw new ConflictException(`Status "${statusName}" already exists`);
    if (!dto.statusCode) dto.statusCode = await uniqueCode(this.repo, "statusCode", statusName);
    const exists = await this.repo.findOne({ where: { statusCode: dto.statusCode } });
    if (exists) throw new ConflictException(`Status code "${dto.statusCode}" already exists`);
    if (dto.displayOrder === undefined) {
      const max = await this.repo.createQueryBuilder("s").select("COALESCE(MAX(s.displayOrder),0)", "m").getRawOne();
      dto.displayOrder = Number(max?.m ?? 0) + 1;
    }
    const saved = await this.repo.save(this.repo.create({ ...dto, statusName, version: 1 }));
    await this.versions.save(this.versions.create({ statusId: saved.statusId, version: 1, label: "Created", statusName, modifiedBy: actor }));
    return saved;
  }

  findAll(): Promise<Status[]> {
    return this.repo.find({ order: { displayOrder: "ASC", statusId: "ASC" } });
  }

  async findOne(id: number): Promise<Status> {
    const s = await this.repo.findOne({ where: { statusId: id } });
    if (!s) throw new NotFoundException(`Status ${id} not found`);
    return s;
  }

  history(id: number): Promise<StatusVersion[]> {
    return this.versions.find({ where: { statusId: id }, order: { version: "DESC" } });
  }

  async update(id: number, dto: UpdateStatusDto, actor = "System"): Promise<Status> {
    const s = await this.findOne(id);
    const type = dto.type ?? s.type;
    const before = { name: s.statusName, description: s.description ?? null, order: s.displayOrder, active: s.isActive, open: s.isOpen, type: s.type };
    if (dto.statusName && dto.statusName.trim().toLowerCase() !== s.statusName.toLowerCase()) {
      const conflict = await this.repo.findOne({ where: { statusName: ILike(dto.statusName.trim()), type } });
      if (conflict && conflict.statusId !== id) throw new ConflictException(`Status "${dto.statusName.trim()}" already exists`);
    }
    if (dto.statusName) dto.statusName = dto.statusName.trim();
    if (dto.statusCode && dto.statusCode !== s.statusCode) {
      const conflict = await this.repo.findOne({ where: { statusCode: dto.statusCode } });
      if (conflict && conflict.statusId !== id) throw new ConflictException(`Status code "${dto.statusCode}" already exists`);
    }
    Object.assign(s, dto);

    // Every change is versioned with who made it.
    const changes: string[] = [];
    if (s.statusName !== before.name) changes.push(`Renamed from "${before.name}" to "${s.statusName}"`);
    if ((s.description ?? null) !== before.description) changes.push("Description updated");
    if (s.displayOrder !== before.order) changes.push(`Display order ${before.order} → ${s.displayOrder}`);
    if (s.isActive !== before.active) changes.push(s.isActive ? "Activated" : "Deactivated");
    if (s.isOpen !== before.open) changes.push(s.isOpen ? "Marked as open status" : "Marked as closed status");
    if (s.type !== before.type) changes.push(`Type changed to ${s.type}`);
    if (changes.length) s.version = (s.version ?? 1) + 1;
    const saved = await this.repo.save(s);
    if (changes.length) {
      await this.versions.save(this.versions.create({
        statusId: id, version: saved.version, label: changes.join("; "), statusName: saved.statusName, modifiedBy: actor,
      }));
    }
    return saved;
  }

  async remove(id: number): Promise<void> {
    const s = await this.findOne(id);
    await this.repo.remove(s);
  }
}
