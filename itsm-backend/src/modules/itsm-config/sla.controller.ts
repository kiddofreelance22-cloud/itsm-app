import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { SlaMatrixDto, UpdateSlaMatrixDto, WorkgroupSlaWindowDto } from "./dto/itsm-config.dto";
import { SlaMatrixEntry } from "./entities/sla-matrix.entity";
import { WorkgroupSlaWindow } from "./entities/workgroup-sla-window.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Priority } from "../priority/entities/priority.entity";
import { SlaServiceWindow } from "../request-masters/entities/sla-service-window.entity";

const row = (m: SlaMatrixEntry, defaults?: { responseSlaMinutes?: number; resolutionSlaMinutes?: number }) => ({
  slaMatrixId: m.slaMatrixId,
  groupId: m.group.groupId, workgroupName: m.group.groupName,
  priorityId: m.priority.priorityId, priorityName: m.priority.priorityName,
  responseMinutes: m.responseMinutes, resolutionMinutes: m.resolutionMinutes,
  defaultResponseMinutes: m.priority.responseSlaMinutes ?? null,
  defaultResolutionMinutes: m.priority.resolutionSlaMinutes ?? null,
  isActive: m.isActive,
  ...(defaults ?? {}),
});

@ApiTags("sla-matrix") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("sla-matrix")
export class SlaMatrixController {
  constructor(
    @InjectRepository(SlaMatrixEntry) private repo: Repository<SlaMatrixEntry>,
    @InjectRepository(AssignmentGroup) private groups: Repository<AssignmentGroup>,
    @InjectRepository(Priority) private priorities: Repository<Priority>,
  ) {}

  @Get() @Roles("Admin", "Fulfiller")
  async list() {
    return (await this.repo.find({ order: { slaMatrixId: "ASC" } })).map((m) => row(m));
  }

  @Post() @Roles("Admin")
  async create(@Body() dto: SlaMatrixDto) {
    this.assertRange(dto.responseMinutes, dto.resolutionMinutes);
    const group = await this.groups.findOne({ where: { groupId: dto.groupId } });
    const priority = await this.priorities.findOne({ where: { priorityId: dto.priorityId } });
    if (!group || !priority) throw new NotFoundException("Workgroup or priority not found");
    const dup = await this.repo.findOne({ where: { group: { groupId: dto.groupId }, priority: { priorityId: dto.priorityId } } });
    if (dup) throw new ConflictException("This Workgroup + Priority combination already exists.");
    const saved = await this.repo.save(this.repo.create({
      group, priority, responseMinutes: dto.responseMinutes, resolutionMinutes: dto.resolutionMinutes, isActive: dto.isActive ?? true,
    }));
    return row(await this.repo.findOneOrFail({ where: { slaMatrixId: saved.slaMatrixId } }));
  }

  @Patch(":id") @Roles("Admin")
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSlaMatrixDto) {
    const m = await this.repo.findOne({ where: { slaMatrixId: id } });
    if (!m) throw new NotFoundException("SLA matrix entry not found");
    const response = dto.responseMinutes ?? m.responseMinutes;
    const resolution = dto.resolutionMinutes ?? m.resolutionMinutes;
    this.assertRange(response, resolution);
    m.responseMinutes = response; m.resolutionMinutes = resolution;
    if (dto.isActive !== undefined) m.isActive = dto.isActive;
    return row(await this.repo.save(m));
  }

  @Delete(":id") @Roles("Admin")
  async remove(@Param("id", ParseIntPipe) id: number) {
    const m = await this.repo.findOne({ where: { slaMatrixId: id } });
    if (!m) throw new NotFoundException("SLA matrix entry not found");
    await this.repo.remove(m);
    return { deleted: true };
  }

  private assertRange(response: number, resolution: number) {
    if (response > resolution) throw new BadRequestException("Response SLA can never exceed the Resolution SLA.");
  }
}

@ApiTags("workgroup-sla-windows") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("workgroup-sla-windows")
export class WorkgroupSlaWindowsController {
  constructor(
    @InjectRepository(WorkgroupSlaWindow) private repo: Repository<WorkgroupSlaWindow>,
    @InjectRepository(AssignmentGroup) private groups: Repository<AssignmentGroup>,
    @InjectRepository(SlaServiceWindow) private windows: Repository<SlaServiceWindow>,
  ) {}

  /** One row per workgroup (including those with no window assigned yet). */
  @Get() @Roles("Admin", "Fulfiller", "Engineer", "IT Agent", "IT Manager", "Service Desk")
  async list() {
    const groups = await this.groups.find({ relations: { manager: true }, order: { groupName: "ASC" } });
    const assigned = new Map((await this.repo.find()).map((a) => [a.groupId, a]));
    return groups.map((g: any) => {
      const a = assigned.get(g.groupId);
      return {
        groupId: g.groupId, workgroupName: g.groupName, manager: g.manager?.fullName ?? "—",
        slaServiceWindowId: a?.slaServiceWindowId ?? null, isActive: a?.isActive ?? true,
      };
    });
  }

  @Put(":groupId") @Roles("Admin")
  async set(@Param("groupId", ParseIntPipe) groupId: number, @Body() dto: WorkgroupSlaWindowDto) {
    if (!(await this.groups.findOne({ where: { groupId } }))) throw new NotFoundException("Workgroup not found");
    if (dto.slaServiceWindowId) {
      if (!(await this.windows.findOne({ where: { slaServiceWindowId: dto.slaServiceWindowId } }))) {
        throw new BadRequestException("Service window not found");
      }
    }
    const current = (await this.repo.findOne({ where: { groupId } })) ?? this.repo.create({ groupId, slaServiceWindowId: null, isActive: true });
    if (dto.slaServiceWindowId !== undefined) current.slaServiceWindowId = dto.slaServiceWindowId;
    if (dto.isActive !== undefined) current.isActive = dto.isActive;
    await this.repo.save(current);
    return this.list().then((all) => all.find((r) => r.groupId === groupId));
  }
}
