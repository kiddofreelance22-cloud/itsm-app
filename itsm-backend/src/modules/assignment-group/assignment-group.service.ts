import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, ILike, IsNull, Not } from "typeorm";
import { AssignmentGroup } from "./entities/assignment-group.entity";
import { User } from "../users/entities/user.entity";
import { Incident } from "../incidents/entities/incident.entity";
import { CreateAssignmentGroupDto, UpdateAssignmentGroupDto } from "./dto/assignment-group.dto";

@Injectable()
export class AssignmentGroupService {
  constructor(
    @InjectRepository(AssignmentGroup) private repo: Repository<AssignmentGroup>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Incident) private incidentRepo: Repository<Incident>,
  ) {}

  /**
   * Workgroups the current user belongs to, with real incident counts pulled
   * straight from the incidents table (not cached/derived) — used by the
   * "My Workgroups" screen: WG Name, Assigned To Me, Total Incidents, Resolved Tickets.
   */
  async getMyWorkgroups(userId: number): Promise<
    { groupId: number; groupName: string; groupCode: string; assignedToMe: number; totalIncidents: number; resolvedTickets: number }[]
  > {
    // Filtered in JS (rather than a `where: { members: { userId } }` clause)
    // because TypeORM's find() doesn't reliably join many-to-many relations
    // for filtering — see the same pattern in DashboardService.
    const allGroups = await this.repo.find({
      where: { isActive: true },
      relations: { members: true },
      order: { groupName: "ASC" },
    });
    const groups = allGroups.filter((g) => g.members?.some((m) => m.userId === userId));

    return Promise.all(
      groups.map(async (g) => {
        const [assignedToMe, totalIncidents, resolvedTickets] = await Promise.all([
          this.incidentRepo.count({
            where: {
              assignmentGroup: { groupId: g.groupId },
              assignedTo: { userId },
              status: Not(In(["Closed", "Resolved"])),
            },
          }),
          this.incidentRepo.count({
            where: {
              assignmentGroup: { groupId: g.groupId },
              status: Not(In(["Closed", "Resolved"])),
            },
          }),
          this.incidentRepo.count({
            where: {
              assignmentGroup: { groupId: g.groupId },
              status: "Resolved",
            },
          }),
        ]);
        return {
          groupId: g.groupId,
          groupName: g.groupName,
          groupCode: g.groupCode,
          assignedToMe,
          totalIncidents,
          resolvedTickets,
        };
      })
    );
  }

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

  /** Admins get every group. Anyone else gets only the groups they are a member of. */
  async findAllVisibleTo(userId: number, roles: string[]): Promise<AssignmentGroup[]> {
    const all = await this.findAll();
    if (roles.some((r) => r === "Admin" || r === "Administrator")) return all;
    return all.filter((g) => g.members?.some((m) => m.userId === userId));
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
    if (memberIds !== undefined) {
      const removedUserIds = (e.members ?? [])
        .map((m) => m.userId)
        .filter((uid) => !memberIds.includes(uid));
      for (const uid of removedUserIds) {
        const openCount = await this.incidentRepo.count({
          where: {
            assignmentGroup: { groupId: id },
            assignedTo: { userId: uid },
            status: Not(In(["Closed", "Resolved"])),
          },
        });
        if (openCount > 0) {
          const userObj = e.members.find((m) => m.userId === uid);
          throw new ConflictException(
            `Cannot remove ${userObj?.fullName ?? "resolver"} from workgroup "${e.groupName}" because they have ${openCount} open ticket(s) assigned in this workgroup. Please reassign or resolve all open tickets first.`
          );
        }
      }
      e.members = memberIds.length ? await this.userRepo.find({ where: { userId: In(memberIds) } }) : [];
    }
    Object.assign(e, rest);

    if (e.isDefault) {
      await this.repo.update({ isDefault: true }, { isDefault: false });
    }

    return this.repo.save(e);
  }

  async remove(id: number): Promise<void> {
    const e = await this.findOne(id);
    if (e.members?.length > 0) {
      throw new ConflictException(
        `Cannot delete "${e.groupName}" — it still has ${e.members.length} member(s). Remove them from the group first.`
      );
    }
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
    const openCount = await this.incidentRepo.count({
      where: {
        assignmentGroup: { groupId },
        assignedTo: { userId },
        status: Not(In(["Closed", "Resolved"])),
      },
    });
    if (openCount > 0) {
      throw new ConflictException(
        `Cannot remove resolver from workgroup "${group.groupName}" because they have ${openCount} open ticket(s) assigned in this workgroup. Please reassign or resolve all open tickets first.`
      );
    }
    group.members = group.members.filter((m) => m.userId !== userId);
    await this.repo.save(group);
    return this.findOne(groupId);
  }

  async countOpenTickets(groupId: number, userId: number): Promise<{ count: number; hasOpenTickets: boolean }> {
    const count = await this.incidentRepo.count({
      where: {
        assignmentGroup: { groupId },
        assignedTo: { userId },
        status: Not(In(["Closed", "Resolved"])),
      },
    });
    return { count, hasOpenTickets: count > 0 };
  }
}
