import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import {
  ClassificationDto, NotificationRuleDto, SaveApprovalRulesDto, SaveMandatoryRulesDto, SetTransitionsDto,
  UpdateClassificationDto, UpdateNotificationRuleDto,
} from "./dto/itsm-config.dto";
import { Classification } from "./entities/classification.entity";
import { StatusTransition } from "./entities/status-transition.entity";
import { MandatoryFieldRule } from "./entities/mandatory-field-rule.entity";
import { ApprovalRule } from "./entities/approval-rule.entity";
import { NotificationRule } from "./entities/notification-rule.entity";
import { Status } from "../status/entities/status.entity";
import { Priority } from "../priority/entities/priority.entity";
import { Category } from "../categories/entities/category.entity";
import { Urgency } from "../urgency/entities/urgency.entity";
import { Impact } from "../impact/entities/impact.entity";
import { PendingReason } from "../request-masters/entities/pending-reason.entity";

const MAX_LEVEL = 5;
export const RECOMMENDED_FLOW: Record<string, string[]> = {
  Open: ["Assigned", "In Progress", "On Hold", "Resolved", "Closed"],
  Assigned: ["Open", "In Progress", "On Hold", "Resolved"],
  "In Progress": ["Assigned", "On Hold", "Resolved"],
  "On Hold": ["Assigned", "In Progress", "Resolved"],
  Resolved: ["Open", "In Progress", "Closed"],
  Closed: ["Open"],
};
const BASE_STATUSES = Object.keys(RECOMMENDED_FLOW);

// ───────────────────────── Classification tree ─────────────────────────
@ApiTags("classifications") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("classifications")
export class ClassificationsController {
  constructor(@InjectRepository(Classification) private repo: Repository<Classification>) {}

  /** Flat list; the UI builds the tree from parentId. */
  @Get() list() { return this.repo.find({ order: { level: "ASC", name: "ASC" } }); }

  @Post() @Roles("Admin")
  async create(@Body() dto: ClassificationDto) {
    let level = 1;
    if (dto.parentId) {
      const parent = await this.repo.findOne({ where: { classificationId: dto.parentId } });
      if (!parent) throw new NotFoundException("Parent classification not found");
      level = parent.level + 1;
    }
    if (level > MAX_LEVEL) throw new BadRequestException(`Classifications can be at most ${MAX_LEVEL} levels deep.`);
    await this.assertSiblingUnique(dto.name, dto.parentId ?? null);
    return this.repo.save(this.repo.create({ name: dto.name.trim(), parentId: dto.parentId ?? null, level, isActive: dto.isActive ?? true }));
  }

  @Patch(":id") @Roles("Admin")
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateClassificationDto) {
    const node = await this.repo.findOne({ where: { classificationId: id } });
    if (!node) throw new NotFoundException("Classification not found");
    const newParent = dto.parentId !== undefined ? dto.parentId : node.parentId;
    const newName = dto.name !== undefined ? dto.name.trim() : node.name;

    if (newParent !== node.parentId || newName.toLowerCase() !== node.name.toLowerCase()) {
      await this.assertSiblingUnique(newName, newParent ?? null, id);
    }
    if (dto.parentId !== undefined && newParent !== node.parentId) {
      const all = await this.repo.find();
      const byId = new Map(all.map((c) => [c.classificationId, c]));
      // cycle check: the new parent must not be this node or one of its descendants
      for (let cur = newParent ? byId.get(newParent) : undefined; cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
        if (cur.classificationId === id) throw new BadRequestException("A classification cannot be moved under itself.");
      }
      const parentLevel = newParent ? byId.get(newParent)?.level ?? 0 : 0;
      const delta = parentLevel + 1 - node.level;
      const subtree = this.collect(all, id);
      if (Math.max(...subtree.map((c) => c.level)) + delta > MAX_LEVEL) {
        throw new BadRequestException(`Moving this branch would exceed ${MAX_LEVEL} levels.`);
      }
      await this.repo.manager.transaction(async (tx) => {
        for (const c of subtree) await tx.update(Classification, { classificationId: c.classificationId }, { level: c.level + delta });
        await tx.update(Classification, { classificationId: id }, { parentId: newParent ?? null });
      });
    }
    await this.repo.update({ classificationId: id }, {
      ...(dto.name !== undefined ? { name: newName } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
    return this.repo.findOne({ where: { classificationId: id } });
  }

  @Delete(":id") @Roles("Admin")
  async remove(@Param("id", ParseIntPipe) id: number) {
    const node = await this.repo.findOne({ where: { classificationId: id } });
    if (!node) throw new NotFoundException("Classification not found");
    await this.repo.remove(node); // children cascade in the database
    return { deleted: true };
  }

  private collect(all: Classification[], rootId: number): Classification[] {
    const out: Classification[] = [];
    const walk = (id: number) => {
      const n = all.find((c) => c.classificationId === id);
      if (!n) return;
      out.push(n);
      all.filter((c) => c.parentId === id).forEach((c) => walk(c.classificationId));
    };
    walk(rootId);
    return out;
  }

  private async assertSiblingUnique(name: string, parentId: number | null, exceptId?: number) {
    const sibs = await this.repo.find({ where: { parentId: parentId as any } });
    const rows = parentId === null ? (await this.repo.find()).filter((c) => c.parentId === null) : sibs;
    if (rows.some((c) => c.name.toLowerCase() === name.trim().toLowerCase() && c.classificationId !== exceptId)) {
      throw new ConflictException(`"${name.trim()}" already exists at this level.`);
    }
  }
}

// ───────────────────────── Status transition matrix ─────────────────────────
@ApiTags("status-transitions") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("status-transitions")
export class StatusTransitionsController {
  constructor(
    @InjectRepository(StatusTransition) private repo: Repository<StatusTransition>,
    @InjectRepository(Status) private statuses: Repository<Status>,
  ) {}

  @Get()
  async matrix() {
    const rows = await this.repo.find();
    const extra = (await this.statuses.find({ where: { isActive: true } }))
      .filter((s) => s.type === "incident").map((s) => s.statusName);
    const statuses = [...new Set([...BASE_STATUSES, ...extra, ...rows.map((r) => r.fromStatus)])];
    return {
      statuses,
      transitions: rows.filter((r) => r.allowed).map((r) => ({ from: r.fromStatus, to: r.toStatus })),
      // Explicitly forbidden moves. A status that is simply absent from the matrix (e.g. one created
      // after it was last saved) is NOT blocked — the server allows it — so clients hide only these.
      blocked: rows.filter((r) => !r.allowed).map((r) => ({ from: r.fromStatus, to: r.toStatus })),
    };
  }

  /** Replace the allowed-next list for one status ("Changes save immediately" on the board). */
  @Put(":from") @Roles("Admin")
  async setFor(@Param("from") from: string, @Body() dto: SetTransitionsDto) {
    const { statuses } = await this.matrix();
    if (!statuses.includes(from)) throw new NotFoundException(`Unknown status "${from}"`);
    const bad = dto.allowedTo.filter((t) => !statuses.includes(t) || t === from);
    if (bad.length) throw new BadRequestException(`Invalid target status: ${bad.join(", ")}`);
    await this.repo.manager.transaction(async (tx) => {
      for (const to of statuses.filter((s) => s !== from)) {
        await tx.save(StatusTransition, { fromStatus: from, toStatus: to, allowed: dto.allowedTo.includes(to) });
      }
    });
    return this.matrix();
  }

  @Post("reset") @Roles("Admin")
  async reset() {
    const { statuses } = await this.matrix();
    await this.repo.manager.transaction(async (tx) => {
      for (const from of statuses) for (const to of statuses) {
        if (from === to) continue;
        await tx.save(StatusTransition, { fromStatus: from, toStatus: to, allowed: !!RECOMMENDED_FLOW[from]?.includes(to) });
      }
    });
    return this.matrix();
  }
}

// ───────────────────────── Mandatory field rules ─────────────────────────
@ApiTags("mandatory-field-rules") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("mandatory-field-rules")
export class MandatoryFieldRulesController {
  constructor(@InjectRepository(MandatoryFieldRule) private repo: Repository<MandatoryFieldRule>) {}

  @Get() list() { return this.repo.find({ order: { displayOrder: "ASC", ruleId: "ASC" } }); }

  /** "Save Rules": the saved list replaces the stored list atomically. */
  @Put() @Roles("Admin")
  async save(@Body() dto: SaveMandatoryRulesDto) {
    dto.rules.forEach((r, i) => {
      if (!r.conditionValues.length) throw new BadRequestException(`Rule ${i + 1}: choose at least one value for "${r.conditionField}".`);
      if (!r.targetFields.length) throw new BadRequestException(`Rule ${i + 1}: choose at least one mandatory field.`);
    });
    await this.repo.manager.transaction(async (tx) => {
      await tx.createQueryBuilder().delete().from(MandatoryFieldRule).execute();
      await tx.save(MandatoryFieldRule, dto.rules.map((r, i) => tx.create(MandatoryFieldRule, {
        name: r.name?.trim() || `Rule ${i + 1}`, conditionField: r.conditionField, conditionValues: r.conditionValues,
        targetFields: r.targetFields, isActive: r.isActive ?? true, displayOrder: i + 1,
      })));
    });
    return this.list();
  }
}

// ───────────────────────── Approval rules ─────────────────────────
@ApiTags("approval-rules") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("approval-rules")
export class ApprovalRulesController {
  constructor(@InjectRepository(ApprovalRule) private repo: Repository<ApprovalRule>) {}

  @Get() list() { return this.repo.find({ order: { displayOrder: "ASC", ruleId: "ASC" } }); }

  @Put() @Roles("Admin")
  async save(@Body() dto: SaveApprovalRulesDto) {
    dto.rules.forEach((r, i) => {
      if (r.conditionField !== "Any Incident" && !r.conditionValues.length) {
        throw new BadRequestException(`Rule ${i + 1}: choose at least one value for "${r.conditionField}".`);
      }
    });
    await this.repo.manager.transaction(async (tx) => {
      await tx.createQueryBuilder().delete().from(ApprovalRule).execute();
      await tx.save(ApprovalRule, dto.rules.map((r, i) => tx.create(ApprovalRule, {
        name: r.name?.trim() || `Rule ${i + 1}`, action: r.action, approvalType: r.approvalType,
        conditionField: r.conditionField, conditionValues: r.conditionField === "Any Incident" ? [] : r.conditionValues,
        isActive: r.isActive ?? true, displayOrder: i + 1,
      })));
    });
    return this.list();
  }
}

/** Value lists for the rule builders, read from the live masters. */
@ApiTags("rule-options") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("rule-options")
export class RuleOptionsController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Get()
  async options() {
    const names = async <T>(e: new () => T, key: keyof T, order?: any) =>
      (await this.ds.getRepository(e as any).find({ where: { isActive: true } as any, order })).map((r: any) => r[key] as string);
    const [priority, category, urgency, impact, pendingReason, classification, transitions] = await Promise.all([
      names(Priority, "priorityName"), names(Category, "categoryName"), names(Urgency, "urgencyName"),
      names(Impact, "impactName"), names(PendingReason, "pendingReasonName"),
      this.ds.getRepository(Classification).find({ where: { isActive: true }, order: { name: "ASC" } }),
      this.ds.getRepository(StatusTransition).find(),
    ]);
    const status = [...new Set([...BASE_STATUSES, ...transitions.map((t) => t.fromStatus)])];
    return {
      Status: status, Priority: priority, Category: category, Urgency: urgency, Impact: impact,
      "Pending Reason": pendingReason, Classification: classification.map((c) => c.name),
    };
  }
}

// ───────────────────────── E-mail notification rules ─────────────────────────
@ApiTags("notification-rules") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("notification-rules")
export class NotificationRulesController {
  constructor(@InjectRepository(NotificationRule) private repo: Repository<NotificationRule>) {}

  @Get() @Roles("Admin") list() { return this.repo.find({ order: { displayOrder: "ASC", ruleId: "ASC" } }); }

  @Post() @Roles("Admin")
  async create(@Body() dto: NotificationRuleDto) {
    await this.assertUnique(dto.name);
    const max = await this.repo.createQueryBuilder("n").select("COALESCE(MAX(n.displayOrder),0)", "max").getRawOne();
    return this.repo.save(this.repo.create({
      name: dto.name.trim(), triggerEvent: dto.triggerEvent, recipients: dto.recipients, subject: dto.subject,
      body: dto.body ?? "", bodyFormat: dto.bodyFormat ?? "text", displayOrder: dto.displayOrder ?? Number(max?.max ?? 0) + 1, isActive: dto.isActive ?? true,
    }));
  }

  @Patch(":id") @Roles("Admin")
  async update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateNotificationRuleDto) {
    const row = await this.repo.findOne({ where: { ruleId: id } });
    if (!row) throw new NotFoundException("Notification rule not found");
    if (dto.name !== undefined && dto.name.trim().toLowerCase() !== row.name.toLowerCase()) await this.assertUnique(dto.name, id);
    Object.assign(row, { ...dto, ...(dto.name !== undefined ? { name: dto.name.trim() } : {}) });
    return this.repo.save(row);
  }

  @Delete(":id") @Roles("Admin")
  async remove(@Param("id", ParseIntPipe) id: number) {
    const row = await this.repo.findOne({ where: { ruleId: id } });
    if (!row) throw new NotFoundException("Notification rule not found");
    await this.repo.remove(row);
    return { deleted: true };
  }

  private async assertUnique(name: string, exceptId?: number) {
    const clash = await this.repo.createQueryBuilder("n").where("lower(n.name) = lower(:n)", { n: name.trim() }).getOne();
    if (clash && clash.ruleId !== exceptId) throw new ConflictException(`A rule named "${name.trim()}" already exists.`);
  }
}

// ───────────────────────── Log Incident Page ─────────────────────────
import { LogIncidentField } from "./entities/incident-record.entities";
import { IsArray as _IsArray, IsBoolean as _IsBoolean, IsString as _IsString, ValidateNested as _ValidateNested } from "class-validator";
import { Type as _Type } from "class-transformer";

class LogFieldRowDto {
  @_IsString() fieldKey!: string;
  @_IsBoolean() visible!: boolean;
  @_IsBoolean() required!: boolean;
}
class SaveLogFieldsDto {
  @_IsArray() @_ValidateNested({ each: true }) @_Type(() => LogFieldRowDto) fields!: LogFieldRowDto[];
}
const LOG_FIELD_DEFAULTS: Record<string, { visible: boolean; required: boolean }> = {
  category: { visible: true, required: true }, classification: { visible: true, required: true }, shortDescription: { visible: true, required: true },
  description: { visible: true, required: true }, priority: { visible: true, required: true }, impact: { visible: true, required: true },
  urgency: { visible: true, required: true }, assignmentGroup: { visible: true, required: false }, assignedTo: { visible: false, required: false },
  configurationItem: { visible: true, required: false }, contactType: { visible: true, required: true }, location: { visible: false, required: false },
  attachments: { visible: true, required: false },
};

@ApiTags("log-incident-fields") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("log-incident-fields")
export class LogIncidentFieldsController {
  constructor(@InjectRepository(LogIncidentField) private repo: Repository<LogIncidentField>) {}

  /** Everyone signed in needs this: the New Incident form is built from it. */
  @Get() list() { return this.repo.find({ order: { displayOrder: "ASC" } }); }

  @Put() @Roles("Admin")
  async save(@Body() dto: SaveLogFieldsDto) {
    const known = new Set((await this.repo.find()).map((f) => f.fieldKey));
    for (const f of dto.fields) if (!known.has(f.fieldKey)) throw new BadRequestException(`Unknown field "${f.fieldKey}".`);
    await this.repo.manager.transaction(async (tx) => {
      for (const f of dto.fields) await tx.update(LogIncidentField, { fieldKey: f.fieldKey }, { visible: f.visible, required: f.visible && f.required });
    });
    return this.list();
  }

  @Post("reset") @Roles("Admin")
  async reset() {
    await this.repo.manager.transaction(async (tx) => {
      for (const [k, v] of Object.entries(LOG_FIELD_DEFAULTS)) await tx.update(LogIncidentField, { fieldKey: k }, v);
    });
    return this.list();
  }
}
