import { Body, ConflictException, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards, Controller, Type, ValidationPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { ChecklistTemplateDto, MasterItemDto, UpdateChecklistTemplateDto, UpdateMasterItemDto } from "./dto/itsm-config.dto";
import { IncidentChecklist } from "./entities/incident-checklist.entity";
import { WoChecklistItem } from "./entities/wo-checklist-item.entity";
import { OnHoldReason } from "./entities/on-hold-reason.entity";
import { ResolutionCode } from "./entities/resolution-code.entity";

/**
 * One CRUD controller per simple "ordered master" screen. Reads are open to any
 * signed-in user (resolver forms need the lists); writes are Admin only.
 */
const cleanTasks = (tasks: ChecklistTemplateDto["tasks"]) => (tasks ?? []).map((t) => ({
  taskName: t.taskName.trim(), taskStatus: t.taskStatus ?? "Optional", remarks: t.remarks ?? "", isActive: t.isActive ?? true,
}));

function createMasterController(path: string, entity: Type<any>, label: string, withSlaImpact = false, scoped = false): Type<any> {
  // Checklist templates carry extra scope/task fields, so they validate against their own DTO.
  const CreateDto: Type<any> = scoped ? ChecklistTemplateDto : MasterItemDto;
  const UpdateDto: Type<any> = scoped ? UpdateChecklistTemplateDto : UpdateMasterItemDto;
  const vp = (expectedType: Type<any>) => new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, expectedType });
  @ApiTags(path)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Controller(path)
  class MasterController {
    constructor(@InjectRepository(entity) private readonly repo: Repository<any>) {}

    @Get() list() { return this.repo.find({ order: { displayOrder: "ASC", id: "ASC" } }); }

    @Post() @Roles("Admin")
    async create(@Body(vp(CreateDto)) dto: any) {
      await this.assertUnique(dto.name);
      const max = await this.repo.createQueryBuilder("m").select("COALESCE(MAX(m.displayOrder),0)", "max").getRawOne();
      return this.repo.save(this.repo.create({
        name: dto.name.trim(),
        description: dto.description ?? null,
        displayOrder: dto.displayOrder ?? Number(max?.max ?? 0) + 1,
        isActive: dto.isActive ?? true,
        ...(withSlaImpact ? { slaImpact: dto.slaImpact ?? "pause" } : {}),
        ...(scoped ? {
          groupId: dto.groupId ?? null, statusName: dto.statusName?.trim() || null, categoryId: dto.categoryId ?? null,
          includeSubCategories: dto.includeSubCategories ?? false, tasks: cleanTasks(dto.tasks),
        } : {}),
      }));
    }

    @Patch(":id") @Roles("Admin")
    async update(@Param("id", ParseIntPipe) id: number, @Body(vp(UpdateDto)) dto: any) {
      const row = await this.repo.findOne({ where: { id } });
      if (!row) throw new NotFoundException(`${label} ${id} not found`);
      if (dto.name !== undefined && dto.name.trim().toLowerCase() !== row.name.toLowerCase()) await this.assertUnique(dto.name, id);
      if (dto.name !== undefined) row.name = dto.name.trim();
      if (dto.description !== undefined) row.description = dto.description;
      if (dto.displayOrder !== undefined) row.displayOrder = dto.displayOrder;
      if (dto.isActive !== undefined) row.isActive = dto.isActive;
      if (withSlaImpact && dto.slaImpact !== undefined) row.slaImpact = dto.slaImpact;
      if (scoped) {
        if (dto.groupId !== undefined) row.groupId = dto.groupId;
        if (dto.statusName !== undefined) row.statusName = dto.statusName?.trim() || null;
        if (dto.categoryId !== undefined) row.categoryId = dto.categoryId;
        if (dto.includeSubCategories !== undefined) row.includeSubCategories = dto.includeSubCategories;
        if (dto.tasks !== undefined) row.tasks = cleanTasks(dto.tasks);
      }
      return this.repo.save(row);
    }

    @Delete(":id") @Roles("Admin")
    async remove(@Param("id", ParseIntPipe) id: number) {
      const row = await this.repo.findOne({ where: { id } });
      if (!row) throw new NotFoundException(`${label} ${id} not found`);
      await this.repo.remove(row);
      return { deleted: true };
    }

    private async assertUnique(name: string, exceptId?: number) {
      const clash = await this.repo.createQueryBuilder("m").where("lower(m.name) = lower(:n)", { n: name.trim() }).getOne();
      if (clash && clash.id !== exceptId) throw new ConflictException(`A ${label.toLowerCase()} named "${name.trim()}" already exists.`);
    }
  }
  return MasterController;
}

export const ChecklistsController = createMasterController("checklists", IncidentChecklist, "Checklist", false, true);
export const WoChecklistItemsController = createMasterController("wo-checklist-items", WoChecklistItem, "Checklist item");
export const OnHoldReasonsController = createMasterController("on-hold-reasons", OnHoldReason, "On hold reason", true);
export const ResolutionCodesController = createMasterController("resolution-codes", ResolutionCode, "Resolution code");
