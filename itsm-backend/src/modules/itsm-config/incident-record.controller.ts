import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post, Put, Patch, Query, UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Incident } from "../incidents/entities/incident.entity";
import { IncidentTicketLinksService } from "../incidents/incident-ticket-links.service";
import { AttachLinkDto, LinkCandidatesQueryDto } from "../requests/dto/request-links.dto";
import { IncidentActivity } from "../incidents/entities/incident-activity.entity";
import { WoChecklistItem } from "./entities/wo-checklist-item.entity";
import { IncidentAttachment, IncidentChecklistProgress, IncidentLink, RoleNavigationAccess } from "./entities/incident-record.entities";
import { RuleEngineService } from "./rule-engine.service";
import { IncidentsService } from "../incidents/incidents.service";
import { Role } from "../roles/entities/role.entity";

class ToggleChecklistDto { @IsInt() itemId!: number; @IsBoolean() done!: boolean; }
class LinkDto { @IsString() @IsNotEmpty() @MaxLength(60) incidentRef!: string; }
class NavRowDto {
  @IsString() @IsNotEmpty() @MaxLength(120) navKey!: string;
  @IsBoolean() visible!: boolean;
  @IsBoolean() canCreate!: boolean;
  @IsOptional() @IsInt() roleId?: number;
}
class SaveNavDto { @IsArray() @ArrayMaxSize(300) @ValidateNested({ each: true }) @Type(() => NavRowDto) rows!: NavRowDto[]; }

/** Everything the Incident Record screen needs beyond the base incident: checklist, related items, SLA resume. */
@ApiTags("incident-record") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("incidents")
export class IncidentRecordController {
  constructor(
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    @InjectRepository(WoChecklistItem) private items: Repository<WoChecklistItem>,
    @InjectRepository(IncidentChecklistProgress) private progress: Repository<IncidentChecklistProgress>,
    @InjectRepository(IncidentLink) private links: Repository<IncidentLink>,
    @InjectRepository(IncidentAttachment) private attachments: Repository<IncidentAttachment>,
    @InjectRepository(IncidentActivity) private activities: Repository<IncidentActivity>,
    private rules: RuleEngineService,
    private svc: IncidentsService,
    private ticketLinks: IncidentTicketLinksService,
  ) {}

  private async mustFind(ref: string): Promise<Incident> {
    const i = await this.incidents.findOne({ where: [{ incidentId: ref }, { incidentCode: ref }] });
    if (!i) throw new NotFoundException(`Incident ${ref} not found`);
    return i;
  }
  private assertOpenForEdit(i: Incident) {
    if (["Closed", "Cancelled"].includes(i.status)) throw new BadRequestException(`This incident is ${i.status.toLowerCase()} and locked.`);
  }

  /** Items that name evidence (an attachment / a CI) can only be ticked once that evidence exists on the incident. */
  private async assertEvidence(inc: Incident, itemId: number) {
    const cl = await this.rules.checklistFor(inc.incidentId);
    const item = cl.items.find((x) => x.id === itemId);
    if (!item) return;
    const text = `${item.name} ${item.description}`.toLowerCase();
    if (/\b(attach|upload|screenshot|evidence)|\blogs?\b/.test(text) && !(await this.attachments.count({ where: { incidentId: inc.incidentId } }))) {
      throw new BadRequestException(`Attach the supporting file to this incident before ticking "${item.name}".`);
    }
    if (/\b(ci|configuration item|asset)\b/.test(text) && !inc.affectedAsset?.trim()) {
      throw new BadRequestException(`Set the Configuration Item / Affected Asset on this incident before ticking "${item.name}".`);
    }
  }

  // ── Checklist ──
  @Get(":id/checklist") @Roles("Admin", "Fulfiller")
  async checklist(@Param("id") id: string) {
    try {
      const inc = await this.mustFind(id);
      return this.rules.checklistFor(inc.incidentId);
    } catch (error) {
      console.error('Checklist error for incident:', id, error);
      throw error;
    }
  }

  @Patch(":id/checklist") @Roles("Admin", "Fulfiller")
  async toggle(@Param("id") id: string, @CurrentUser("userId") userId: number, @Body() dto: ToggleChecklistDto) {
    const inc = await this.mustFind(id);
    this.assertOpenForEdit(inc);
    if (dto.itemId < 0) {
      // A task from a Checklist template: it must be part of this incident's current checklist.
      const cl = await this.rules.checklistFor(inc.incidentId);
      if (!cl.items.some((x) => x.id === dto.itemId)) throw new NotFoundException("Checklist item not found");
    } else {
      const item = await this.items.findOne({ where: { id: dto.itemId, isActive: true } });
      if (!item) throw new NotFoundException("Checklist item not found");
    }
    if (dto.done) await this.assertEvidence(inc, dto.itemId);
    await this.progress.save({ incidentId: inc.incidentId, itemId: dto.itemId, done: dto.done, doneBy: dto.done ? userId : null, doneAt: dto.done ? new Date() : null });
    // Audit trail: who ticked / un-ticked which task, and when.
    const after = await this.rules.checklistFor(inc.incidentId);
    const label = after.items.find((x) => x.id === dto.itemId)?.name ?? `item ${dto.itemId}`;
    await this.activities.save(this.activities.create({
      incident: inc, actor: { userId } as any, type: "work_note",
      content: `Checklist task "${label}" marked ${dto.done ? "done" : "not done"}.`, meta: { itemId: dto.itemId, done: dto.done },
    }));
    return after;
  }

  // ── Related items ──
  private async linkRows(incidentId: string) {
    const rows = await this.links.find({ where: [{ incidentId }, { linkedIncidentId: incidentId }], order: { linkId: "ASC" } });
    const otherIds = rows.map((r) => (r.incidentId === incidentId ? r.linkedIncidentId : r.incidentId));
    const others = otherIds.length ? await this.incidents.find({ where: { incidentId: In(otherIds) } }) : [];
    return rows.map((r) => {
      const oid = r.incidentId === incidentId ? r.linkedIncidentId : r.incidentId;
      const o = others.find((x) => x.incidentId === oid);
      return { linkId: r.linkId, incidentId: oid, incidentRef: o?.incidentCode ?? oid, shortDescription: o?.title ?? "", status: o?.status ?? "" };
    });
  }

  @Get(":id/links") @Roles("Admin", "Fulfiller")
  async listLinks(@Param("id") id: string) { return this.linkRows((await this.mustFind(id)).incidentId); }

  @Post(":id/links") @Roles("Admin", "Fulfiller")
  async addLink(@Param("id") id: string, @CurrentUser("userId") userId: number, @Body() dto: LinkDto) {
    const a = await this.mustFind(id);
    this.assertOpenForEdit(a);
    const b = await this.incidents.findOne({ where: [{ incidentId: dto.incidentRef.trim() }, { incidentCode: dto.incidentRef.trim() }] });
    if (!b) throw new NotFoundException(`Incident ${dto.incidentRef.trim()} not found`);
    if (a.incidentId === b.incidentId) throw new BadRequestException("An incident cannot be linked to itself.");
    const exists = await this.links.findOne({ where: [
      { incidentId: a.incidentId, linkedIncidentId: b.incidentId }, { incidentId: b.incidentId, linkedIncidentId: a.incidentId },
    ] });
    if (exists) throw new BadRequestException("These incidents are already linked.");
    await this.links.save(this.links.create({ incidentId: a.incidentId, linkedIncidentId: b.incidentId, createdBy: userId }));
    return this.linkRows(a.incidentId);
  }

  @Delete(":id/links/:linkId") @Roles("Admin", "Fulfiller")
  async removeLink(@Param("id") id: string, @Param("linkId", ParseIntPipe) linkId: number) {
    const a = await this.mustFind(id);
    this.assertOpenForEdit(a);
    const row = await this.links.findOne({ where: { linkId } });
    if (!row || (row.incidentId !== a.incidentId && row.linkedIncidentId !== a.incidentId)) throw new NotFoundException("Link not found");
    await this.links.remove(row);
    return this.linkRows(a.incidentId);
  }

  // ── Links to tickets of any type ──
  @Get(":id/ticket-links/candidates") @Roles("Admin", "Fulfiller")
  linkCandidates(@Param("id") id: string, @CurrentUser("userId") userId: number, @Query() query: LinkCandidatesQueryDto) {
    return this.ticketLinks.candidates(id, userId, query);
  }

  @Get(":id/ticket-links") @Roles("Admin", "Fulfiller")
  listTicketLinks(@Param("id") id: string) { return this.ticketLinks.list(id); }

  @Post(":id/ticket-links") @Roles("Admin", "Fulfiller")
  attachTicketLink(@Param("id") id: string, @CurrentUser("userId") userId: number, @Body() dto: AttachLinkDto) {
    return this.ticketLinks.attach(id, userId, dto.type, dto.targetNumber, dto.relation);
  }

  @Delete(":id/ticket-links/:linkId") @Roles("Admin", "Fulfiller")
  removeTicketLink(@Param("id") id: string, @Param("linkId", ParseIntPipe) linkId: number) {
    return this.ticketLinks.remove(id, linkId);
  }

  // ── Resume SLA ──
  @Post(":id/resume-sla") @Roles("Admin", "Fulfiller")
  async resumeSla(@Param("id") id: string, @CurrentUser("userId") userId: number) {
    const inc = await this.mustFind(id);
    if (!inc.slaPausedAt || !this.rules.isPausingStatus(inc.status)) {
      throw new BadRequestException("The Resolution SLA is not paused on this incident.");
    }
    // update() shifts the SLA target by the paused time and clears the pause.
    return this.svc.update(inc.incidentId, { status: "In Progress" }, userId);
  }
}

/** Role > Navigation Access, and the caller's effective access for the sidebar. */
@ApiTags("navigation-access") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller()
export class NavigationAccessController {
  constructor(
    @InjectRepository(RoleNavigationAccess) private repo: Repository<RoleNavigationAccess>,
    @InjectRepository(Role) private roles: Repository<Role>,
  ) {}

  @Get("roles/:roleId/navigation") @Roles("Admin")
  forRole(@Param("roleId", ParseIntPipe) roleId: number) { return this.repo.find({ where: { roleId }, order: { navKey: "ASC" } }); }

  @Put("roles/:roleId/navigation") @Roles("Admin")
  async save(@Param("roleId", ParseIntPipe) roleId: number, @Body() dto: SaveNavDto) {
    if (!(await this.roles.findOne({ where: { roleId } }))) throw new NotFoundException("Role not found");
    const keys = new Set<string>();
    for (const r of dto.rows) {
      if (keys.has(r.navKey)) throw new BadRequestException(`Duplicate navigation item "${r.navKey}".`);
      keys.add(r.navKey);
    }
    await this.repo.manager.transaction(async (tx) => {
      await tx.delete(RoleNavigationAccess, { roleId });
      await tx.save(RoleNavigationAccess, dto.rows.map((r) => tx.create(RoleNavigationAccess, {
        roleId, navKey: r.navKey, visible: r.visible || r.canCreate, canCreate: r.canCreate,
      })));
    });
    return this.forRole(roleId);
  }

  /**
   * Effective access for the signed-in user = union over their roles.
   * `configured: false` means no role of theirs has any rows, so the app's built-in menu applies unchanged.
   */
  @Get("navigation/me")
  async mine(@CurrentUser("userId") userId: number) {
    const rows: Array<{ nav_key: string; visible: boolean; can_create: boolean }> = await this.repo.query(
      `SELECT n.nav_key, bool_or(n.visible) AS visible, bool_or(n.can_create) AS can_create
         FROM role_navigation_access n
         JOIN user_roles ur ON ur.role_id = n.role_id
        WHERE ur.user_id = $1
        GROUP BY n.nav_key`, [userId]);
    return { configured: rows.length > 0, items: rows.map((r) => ({ navKey: r.nav_key, visible: r.visible, canCreate: r.can_create })) };
  }
}
