import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { ClosureCode } from "./entities/closure-code.entity";
import { PendingReason } from "./entities/pending-reason.entity";
import { PriorityMatrix } from "./entities/priority-matrix.entity";
import { SlaServiceWindow } from "./entities/sla-service-window.entity";
import { CreateClosureCodeDto, CreatePendingReasonDto, CreatePriorityMatrixDto, CreateSlaServiceWindowDto, UpdateClosureCodeDto, UpdatePendingReasonDto, UpdatePriorityMatrixDto, UpdateSlaServiceWindowDto } from "./dto/request-masters.dto";
@Injectable()
export class RequestMastersService {
  constructor(@InjectRepository(ClosureCode) private readonly closureCodes: Repository<ClosureCode>, @InjectRepository(PendingReason) private readonly pendingReasons: Repository<PendingReason>, @InjectRepository(PriorityMatrix) private readonly priorityMatrices: Repository<PriorityMatrix>, @InjectRepository(SlaServiceWindow) private readonly slaWindows: Repository<SlaServiceWindow>) {}
  private async unique<T extends object>(repo: Repository<T>, field: keyof T, value: string, label: string, idField?: keyof T, id?: number) { const found = await repo.findOne({ where: { [field]: ILike(value) } as any }); if (found && (!idField || (found as any)[idField] !== id)) throw new ConflictException(`${label} "${value}" already exists`); }
  private parseServiceWindow(value: unknown) {
    const parsed = typeof value === "string" ? (() => { try { return JSON.parse(value); } catch { throw new BadRequestException("Service window must be valid JSON"); } })() : value;
    if (!Array.isArray(parsed)) throw new BadRequestException("Service window must be an array");
    return parsed;
  }
  async createClosureCode(dto: CreateClosureCodeDto) { const name = dto.closureCodeName.trim(); await this.unique(this.closureCodes, "closureCodeName", name, "Closure code"); return this.closureCodes.save(this.closureCodes.create({ ...dto, closureCodeName: name })); }
  listClosureCodes() { return this.closureCodes.find({ order: { closureCodeName: "ASC" } }); }
  async updateClosureCode(id: number, dto: UpdateClosureCodeDto) { const item = await this.closureCodes.findOneBy({ closureCodeId: id }); if (!item) throw new NotFoundException(); if (dto.closureCodeName) { dto.closureCodeName = dto.closureCodeName.trim(); await this.unique(this.closureCodes, "closureCodeName", dto.closureCodeName, "Closure code", "closureCodeId", id); } Object.assign(item, dto); return this.closureCodes.save(item); }
  async removeClosureCode(id: number) { const item = await this.closureCodes.findOneBy({ closureCodeId: id }); if (!item) throw new NotFoundException(); await this.closureCodes.remove(item); }
  async createPendingReason(dto: CreatePendingReasonDto) { const name = dto.pendingReasonName.trim(); await this.unique(this.pendingReasons, "pendingReasonName", name, "Pending reason"); return this.pendingReasons.save(this.pendingReasons.create({ ...dto, pendingReasonName: name })); }
  listPendingReasons() { return this.pendingReasons.find({ order: { pendingReasonName: "ASC" } }); }
  async updatePendingReason(id: number, dto: UpdatePendingReasonDto) { const item = await this.pendingReasons.findOneBy({ pendingReasonId: id }); if (!item) throw new NotFoundException(); if (dto.pendingReasonName) { dto.pendingReasonName = dto.pendingReasonName.trim(); await this.unique(this.pendingReasons, "pendingReasonName", dto.pendingReasonName, "Pending reason", "pendingReasonId", id); } Object.assign(item, dto); return this.pendingReasons.save(item); }
  async removePendingReason(id: number) { const item = await this.pendingReasons.findOneBy({ pendingReasonId: id }); if (!item) throw new NotFoundException(); await this.pendingReasons.remove(item); }
  async createPriorityMatrix(dto: CreatePriorityMatrixDto) { const found = await this.priorityMatrices.findOne({ where: { urgencyId: dto.urgencyId, impactId: dto.impactId } }); if (found) throw new ConflictException("An entry already exists for this urgency and impact"); return this.priorityMatrices.save(this.priorityMatrices.create(dto)); }
  listPriorityMatrices() { return this.priorityMatrices.find({ order: { priorityMatrixId: "ASC" } }); }
  async updatePriorityMatrix(id: number, dto: UpdatePriorityMatrixDto) { const item = await this.priorityMatrices.findOneBy({ priorityMatrixId: id }); if (!item) throw new NotFoundException(); Object.assign(item, dto); return this.priorityMatrices.save(item); }
  async removePriorityMatrix(id: number) { const item = await this.priorityMatrices.findOneBy({ priorityMatrixId: id }); if (!item) throw new NotFoundException(); await this.priorityMatrices.remove(item); }
  async createSlaWindow(dto: CreateSlaServiceWindowDto) { const name = dto.slaName.trim(); await this.unique(this.slaWindows, "slaName", name, "SLA service window"); return this.slaWindows.save(this.slaWindows.create({ ...dto, serviceWindow: this.parseServiceWindow(dto.serviceWindow), slaName: name })); }
  listSlaWindows() { return this.slaWindows.find({ order: { slaName: "ASC" } }); }
  async updateSlaWindow(id: number, dto: UpdateSlaServiceWindowDto) { const item = await this.slaWindows.findOneBy({ slaServiceWindowId: id }); if (!item) throw new NotFoundException(); if (dto.slaName) { dto.slaName = dto.slaName.trim(); await this.unique(this.slaWindows, "slaName", dto.slaName, "SLA service window", "slaServiceWindowId", id); } if (dto.serviceWindow !== undefined) dto.serviceWindow = this.parseServiceWindow(dto.serviceWindow); Object.assign(item, dto); return this.slaWindows.save(item); }
  async removeSlaWindow(id: number) { const item = await this.slaWindows.findOneBy({ slaServiceWindowId: id }); if (!item) throw new NotFoundException(); await this.slaWindows.remove(item); }
}