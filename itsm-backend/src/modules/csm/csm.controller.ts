import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query,
  StreamableFile, UploadedFile, UseGuards, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { createReadStream, existsSync } from "fs";
import { unlink } from "fs/promises";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { isStaff } from "../../common/utils/roles.util";
import { UPLOADS_ROOT } from "../uploads/uploads.service";
import {
  CreateCsmActivityDto, CreateCsmCaseDto, CreateCsmContactDto, CreateCsmContractDto, CreateCsmCustomerDto,
  CreateCsmEscalationDto, CreateCsmMajorCaseDto, CreateCsmSlaDto, CreateCsmViewDto, RenewCsmContractDto,
  UpdateCsmCaseDto, UpdateCsmContactDto, UpdateCsmContractDto, UpdateCsmCustomerDto, UpdateCsmMajorCaseDto, UpdateCsmSlaDto,
} from "./dto/csm.dto";
import { CsmService } from "./csm.service";

const CSM_FILE_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

@ApiTags("csm")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("csm")
export class CsmController {
  constructor(private readonly svc: CsmService) {}

  private requireStaff(roles: string[] | undefined) {
    if (!isStaff(roles)) throw new ForbiddenException("Customer service management is available to support staff.");
  }

  @Get("dashboard")
  dashboard(@CurrentUser("roles") roles: string[], @CurrentUser("userId") userId: number) {
    this.requireStaff(roles);
    return this.svc.dashboard(userId);
  }

  @Get("lookups")
  lookups(@CurrentUser("roles") roles: string[]) { this.requireStaff(roles); return this.svc.lookups(); }

  @Get("cases")
  cases(
    @CurrentUser("roles") roles: string[],
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("customerType") customerType?: string,
    @Query("viewId") viewId?: string,
    @CurrentUser("userId") userId?: number,
  ) {
    this.requireStaff(roles);
    const parsedViewId = viewId ? Number(viewId) : undefined;
    if (parsedViewId !== undefined && (!Number.isInteger(parsedViewId) || parsedViewId < 1)) {
      throw new ForbiddenException("Invalid case view.");
    }
    return this.svc.listCases({ q, status, priority, customerType, viewId: parsedViewId, userId });
  }

  @Post("cases")
  createCase(@CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[], @Body() dto: CreateCsmCaseDto) {
    this.requireStaff(roles);
    return this.svc.createCase(userId, dto);
  }

  @Get("cases/:id/attachments")
  caseAttachments(@CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number) {
    this.requireStaff(roles);
    return this.svc.listCaseAttachments(id);
  }

  @Post("cases/:id/attachments")
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: UPLOADS_ROOT,
      filename: (_req, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase();
      if (CSM_FILE_TYPES[extension] !== file.mimetype) {
        callback(new BadRequestException("Unsupported file type. Use PDF, DOCX, XLSX, TXT, PNG, or JPG files."), false);
        return;
      }
      callback(null, true);
    },
  }))
  async uploadCaseAttachment(
    @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[],
    @Param("id", ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("Select a file to upload.");
    try {
      this.requireStaff(roles);
      return await this.svc.addCaseAttachment(id, userId, file);
    } catch (error) {
      await unlink(file.path);
      throw error;
    }
  }

  @Get("cases/:id/attachments/:attachmentId/download")
  async downloadCaseAttachment(
    @CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number,
    @Param("attachmentId", ParseIntPipe) attachmentId: number,
  ) {
    this.requireStaff(roles);
    const attachment = await this.svc.getCaseAttachment(id, attachmentId);
    const filePath = join(UPLOADS_ROOT, attachment.storageName);
    if (!existsSync(filePath)) throw new BadRequestException("The stored attachment file is unavailable.");
    return new StreamableFile(createReadStream(filePath), {
      type: attachment.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    });
  }

  @Delete("cases/:id/attachments/:attachmentId")
  async deleteCaseAttachment(
    @CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number,
    @Param("attachmentId", ParseIntPipe) attachmentId: number,
  ) {
    this.requireStaff(roles);
    const attachment = await this.svc.getCaseAttachment(id, attachmentId);
    const filePath = join(UPLOADS_ROOT, attachment.storageName);
    if (existsSync(filePath)) await unlink(filePath);
    await this.svc.removeCaseAttachment(id, attachmentId);
    return { deleted: true };
  }

  @Get("cases/:id")
  case(@CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number) {
    this.requireStaff(roles);
    return this.svc.getCase(id);
  }

  @Patch("cases/:id")
  updateCase(
    @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[],
    @Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCsmCaseDto,
  ) {
    this.requireStaff(roles);
    return this.svc.updateCase(id, userId, dto);
  }

  @Get("cases/:id/activity")
  caseActivity(@CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number) {
    this.requireStaff(roles);
    return this.svc.caseActivity(id);
  }

  @Post("cases/:id/activity")
  addCaseActivity(
    @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[],
    @Param("id", ParseIntPipe) id: number, @Body() dto: CreateCsmActivityDto,
  ) {
    this.requireStaff(roles);
    return this.svc.addCaseActivity(id, userId, dto);
  }

  @Get("customers")
  customers(@CurrentUser("roles") roles: string[], @Query("q") q?: string, @Query("type") type?: string) {
    this.requireStaff(roles);
    return this.svc.listCustomers(q, type);
  }

  @Post("customers")
  createCustomer(@CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[], @Body() dto: CreateCsmCustomerDto) {
    this.requireStaff(roles);
    return this.svc.createCustomer(userId, dto);
  }

  @Get("customers/:id")
  customerProfile(@CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number) {
    this.requireStaff(roles);
    return this.svc.getCustomerProfile(id);
  }

  @Patch("customers/:id")
  updateCustomer(
    @CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCsmCustomerDto,
  ) {
    this.requireStaff(roles);
    return this.svc.updateCustomer(id, dto);
  }

  @Get("customers/:id/contacts")
  customerContacts(@CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number) {
    this.requireStaff(roles);
    return this.svc.listCustomerContacts(id);
  }

  @Post("customers/:id/contacts")
  createCustomerContact(
    @CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number, @Body() dto: CreateCsmContactDto,
  ) {
    this.requireStaff(roles);
    return this.svc.createCustomerContact(id, dto);
  }

  @Patch("customers/:id/contacts/:contactId")
  updateCustomerContact(
    @CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number,
    @Param("contactId", ParseIntPipe) contactId: number, @Body() dto: UpdateCsmContactDto,
  ) {
    this.requireStaff(roles);
    return this.svc.updateCustomerContact(id, contactId, dto);
  }

  @Get("customer-health")
  customerHealth(@CurrentUser("roles") roles: string[], @Query("q") q?: string) {
    this.requireStaff(roles);
    return this.svc.customerHealth(q);
  }

  @Get("contracts")
  contracts(@CurrentUser("roles") roles: string[]) { this.requireStaff(roles); return this.svc.listContracts(); }

  @Post("contracts")
  createContract(@CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[], @Body() dto: CreateCsmContractDto) {
    this.requireStaff(roles);
    return this.svc.createContract(userId, dto);
  }

  @Patch("contracts/:id")
  updateContract(
    @CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCsmContractDto,
  ) {
    this.requireStaff(roles);
    return this.svc.updateContract(id, dto);
  }

  @Post("contracts/:id/renew")
  renewContract(
    @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[],
    @Param("id", ParseIntPipe) id: number, @Body() dto: RenewCsmContractDto,
  ) {
    this.requireStaff(roles);
    return this.svc.renewContract(id, userId, dto);
  }

  @Get("slas")
  slas(@CurrentUser("roles") roles: string[]) { this.requireStaff(roles); return this.svc.listSlas(); }

  @Post("slas")
  createSla(@CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[], @Body() dto: CreateCsmSlaDto) {
    this.requireStaff(roles);
    return this.svc.createSla(userId, dto);
  }

  @Patch("slas/:id")
  updateSla(
    @CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCsmSlaDto,
  ) {
    this.requireStaff(roles);
    return this.svc.updateSla(id, dto);
  }

  @Get("escalations")
  escalations(@CurrentUser("roles") roles: string[]) { this.requireStaff(roles); return this.svc.listEscalations(); }

  @Post("escalations")
  createEscalation(
    @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[], @Body() dto: CreateCsmEscalationDto,
  ) {
    this.requireStaff(roles);
    return this.svc.createEscalation(userId, dto);
  }

  @Patch("escalations/:id")
  updateEscalation(
    @CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number, @Body("status") status: string,
  ) {
    this.requireStaff(roles);
    return this.svc.updateEscalation(id, status);
  }

  @Get("major-cases")
  majorCases(@CurrentUser("roles") roles: string[]) { this.requireStaff(roles); return this.svc.listMajorCases(); }

  @Post("major-cases")
  createMajorCase(
    @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[], @Body() dto: CreateCsmMajorCaseDto,
  ) {
    this.requireStaff(roles);
    return this.svc.createMajorCase(userId, dto);
  }

  @Get("major-cases/:id/updates")
  majorCaseUpdates(@CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number) {
    this.requireStaff(roles);
    return this.svc.listMajorUpdates(id);
  }

  @Patch("major-cases/:id")
  updateMajorCase(
    @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[],
    @Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCsmMajorCaseDto,
  ) {
    this.requireStaff(roles);
    return this.svc.updateMajorCase(id, userId, dto.status, dto.update ?? "");
  }

  @Get("views")
  views(@CurrentUser("roles") roles: string[], @CurrentUser("userId") userId: number) {
    this.requireStaff(roles);
    return this.svc.listViews(userId);
  }

  @Post("views")
  createView(@CurrentUser("roles") roles: string[], @CurrentUser("userId") userId: number, @Body() dto: CreateCsmViewDto) {
    this.requireStaff(roles);
    return this.svc.createView(userId, dto);
  }
}
