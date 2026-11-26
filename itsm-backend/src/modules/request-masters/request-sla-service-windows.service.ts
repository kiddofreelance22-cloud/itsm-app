import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { RequestSlaServiceWindow } from "./entities/request-sla-service-window.entity";
import { CreateSlaServiceWindowDto, UpdateSlaServiceWindowDto } from "./dto/request-masters.dto";

@Injectable()
export class RequestSlaServiceWindowsService {
  constructor(
    @InjectRepository(RequestSlaServiceWindow)
    private readonly repo: Repository<RequestSlaServiceWindow>,
  ) {}

  private async unique(value: string, id?: number) {
    const found = await this.repo.findOne({ where: { slaName: ILike(value) } });
    if (found && found.slaServiceWindowId !== id) {
      throw new ConflictException(`Request SLA service window "${value}" already exists`);
    }
  }

  private parseServiceWindow(value: unknown) {
    const parsed =
      typeof value === "string"
        ? (() => {
            try {
              return JSON.parse(value);
            } catch {
              throw new BadRequestException("Service window must be valid JSON");
            }
          })()
        : value;
    if (!Array.isArray(parsed)) throw new BadRequestException("Service window must be an array");
    return parsed;
  }

  async create(dto: CreateSlaServiceWindowDto): Promise<RequestSlaServiceWindow> {
    const name = dto.slaName.trim();
    await this.unique(name);
    return this.repo.save(
      this.repo.create({
        ...dto,
        serviceWindow: this.parseServiceWindow(dto.serviceWindow),
        slaName: name,
      }),
    );
  }

  list(): Promise<RequestSlaServiceWindow[]> {
    return this.repo.find({ order: { displayOrder: "ASC", slaName: "ASC" } });
  }

  async findOne(id: number): Promise<RequestSlaServiceWindow> {
    const item = await this.repo.findOneBy({ slaServiceWindowId: id });
    if (!item) throw new NotFoundException(`Request SLA service window ${id} not found`);
    return item;
  }

  async update(id: number, dto: UpdateSlaServiceWindowDto): Promise<RequestSlaServiceWindow> {
    const item = await this.findOne(id);
    if (dto.slaName) {
      dto.slaName = dto.slaName.trim();
      await this.unique(dto.slaName, id);
    }
    if (dto.serviceWindow !== undefined) {
      dto.serviceWindow = this.parseServiceWindow(dto.serviceWindow);
    }
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.remove(item);
  }
}
