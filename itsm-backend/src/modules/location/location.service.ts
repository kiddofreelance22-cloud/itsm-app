import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Location } from "./entities/location.entity";
import { CreateLocationDto, UpdateLocationDto } from "./dto/location.dto";

@Injectable()
export class LocationService {
  constructor(@InjectRepository(Location) private repo: Repository<Location>) {}
  async create(dto: CreateLocationDto): Promise<Location> {
    const exists = await this.repo.findOne({ where: { locationCode: dto.locationCode } });
    if (exists) throw new ConflictException(`Code "${dto.locationCode}" already exists`);
    return this.repo.save(this.repo.create(dto));
  }
  findAll(): Promise<Location[]> { return this.repo.find({ order: { locationId: "ASC" } }); }
  async findOne(id: number): Promise<Location> {
    const e = await this.repo.findOne({ where: { locationId: id } });
    if (!e) throw new NotFoundException(`Location ${id} not found`);
    return e;
  }
  async update(id: number, dto: UpdateLocationDto): Promise<Location> {
    const e = await this.findOne(id); Object.assign(e, dto); return this.repo.save(e);
  }
  async remove(id: number): Promise<void> {
    const e = await this.findOne(id); await this.repo.remove(e);
  }
}
