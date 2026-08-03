import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { AssignmentGroup } from "./entities/assignment-group.entity";
import { User } from "../users/entities/user.entity";
import { CreateAssignmentGroupDto, UpdateAssignmentGroupDto } from "./dto/assignment-group.dto";

@Injectable()
export class AssignmentGroupService {
  constructor(
    @InjectRepository(AssignmentGroup) private repo: Repository<AssignmentGroup>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async create(dto: CreateAssignmentGroupDto): Promise<AssignmentGroup> {
    const exists = await this.repo.findOne({ where: { groupCode: dto.groupCode } });
    if (exists) throw new ConflictException(`Group code "${dto.groupCode}" already exists`);
    const manager = dto.managerId ? await this.userRepo.findOne({ where: { userId: dto.managerId } }) : null;
    const members = dto.memberIds?.length
      ? await this.userRepo.find({ where: { userId: In(dto.memberIds) } }) : [];
    const { managerId, memberIds, ...rest } = dto;
    const group = this.repo.create({ ...rest, manager, members });
    return this.repo.save(group);
  }

  findAll(): Promise<AssignmentGroup[]> {
    return this.repo.find({ relations: { manager: true, members: true }, order: { groupId: "ASC" } });
  }

  async findOne(id: number): Promise<AssignmentGroup> {
    const e = await this.repo.findOne({ where: { groupId: id }, relations: { manager: true, members: true } });
    if (!e) throw new NotFoundException(`Assignment group ${id} not found`);
    return e;
  }

  async update(id: number, dto: UpdateAssignmentGroupDto): Promise<AssignmentGroup> {
    const e = await this.findOne(id);
    const { managerId, memberIds, ...rest } = dto;
    if (managerId !== undefined)
      e.manager = managerId ? await this.userRepo.findOne({ where: { userId: managerId } }) : null;
    if (memberIds !== undefined)
      e.members = memberIds.length ? await this.userRepo.find({ where: { userId: In(memberIds) } }) : [];
    Object.assign(e, rest);
    return this.repo.save(e);
  }

  async remove(id: number): Promise<void> {
    const e = await this.findOne(id);
    await this.repo.remove(e);
  }
}
