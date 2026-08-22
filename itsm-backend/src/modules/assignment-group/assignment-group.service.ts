import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, ILike } from "typeorm";
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
    const groupName = dto.groupName.trim();
    // Name must be unique (case-insensitive) even if a different code is entered
    const nameConflict = await this.repo.findOne({ where: { groupName: ILike(groupName) } });
    if (nameConflict) throw new ConflictException(`Assignment group "${groupName}" already exists`);
    const exists = await this.repo.findOne({ where: { groupCode: dto.groupCode } });
    if (exists) throw new ConflictException(`Group code "${dto.groupCode}" already exists`);
    const { managerId, memberIds, ...rest } = dto;
    const group = this.repo.create({ ...rest, groupName });
    if (managerId) {
      group.manager = await this.userRepo.findOne({ where: { userId: managerId } }) || undefined;
    }
    if (memberIds?.length) group.members = await this.userRepo.find({ where: { userId: In(memberIds) } });

    if (group.isDefault) {
      await this.repo.update({ isDefault: true }, { isDefault: false });
    }

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

    if (dto.groupName && dto.groupName.trim().toLowerCase() !== e.groupName.toLowerCase()) {
      const conflict = await this.repo.findOne({ where: { groupName: ILike(dto.groupName.trim()) } });
      if (conflict && conflict.groupId !== id)
        throw new ConflictException(`Assignment group "${dto.groupName.trim()}" already exists`);
      dto.groupName = dto.groupName.trim();
    }
    if (dto.groupCode && dto.groupCode !== e.groupCode) {
      const codeConflict = await this.repo.findOne({ where: { groupCode: dto.groupCode } });
      if (codeConflict && codeConflict.groupId !== id)
        throw new ConflictException(`Group code "${dto.groupCode}" already exists`);
    }

    const { managerId, memberIds, ...rest } = dto;
    if (managerId !== undefined)
      e.manager = managerId ? await this.userRepo.findOne({ where: { userId: managerId } }) || undefined : undefined;
    if (memberIds !== undefined)
      e.members = memberIds.length ? await this.userRepo.find({ where: { userId: In(memberIds) } }) : [];
    Object.assign(e, rest);

    if (e.isDefault) {
      await this.repo.update({ isDefault: true }, { isDefault: false });
    }

    return this.repo.save(e);
  }

  async remove(id: number): Promise<void> {
    const e = await this.findOne(id);
    await this.repo.remove(e);
  }

  // ── MEMBERSHIP (single add/remove, used by the User form so multiple
  //    groups can be toggled for one user without clobbering other members
  //    the way a full `update({ memberIds })` would) ─────────────────────────
  async addMember(groupId: number, userId: number): Promise<AssignmentGroup> {
    const group = await this.findOne(groupId);
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (!group.members.some((m) => m.userId === userId)) {
      group.members.push(user);
      await this.repo.save(group);
    }
    return this.findOne(groupId);
  }

  async removeMember(groupId: number, userId: number): Promise<AssignmentGroup> {
    const group = await this.findOne(groupId);
    group.members = group.members.filter((m) => m.userId !== userId);
    await this.repo.save(group);
    return this.findOne(groupId);
  }
}
