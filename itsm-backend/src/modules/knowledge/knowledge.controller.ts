import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { createReadStream, existsSync } from "fs";
import { unlink } from "fs/promises";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { isStaff } from "../../common/utils/roles.util";
import { KnowledgeService } from "./knowledge.service";
import { CreateKnowledgeArticleDto, KnowledgeArticleQueryDto, KnowledgeEventDto, PortalArticleQueryDto, UpdateKnowledgeArticleDto } from "./dto/knowledge.dto";
import { UPLOADS_ROOT } from "../uploads/uploads.service";

const KNOWLEDGE_FILE_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

class WorkaroundStatusDto {
  @IsIn(["Draft", "Pending", "Verified"]) status!: "Draft" | "Pending" | "Verified";
}

/** Knowledge management is a staff workspace; only ratings and portal deflections come from end users. */
const requireStaff = (roles: string[] | undefined) => {
  if (!isStaff(roles)) throw new ForbiddenException("Knowledge management is available to support staff.");
};

@ApiTags("knowledge") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("knowledge")
export class KnowledgeController {
  constructor(private readonly svc: KnowledgeService) {}

  @Get("dashboard")
  dashboard(@CurrentUser("roles") roles: string[]) { requireStaff(roles); return this.svc.dashboard(); }

  @Get("health")
  health(@CurrentUser("roles") roles: string[]) { requireStaff(roles); return this.svc.health(); }

  @Post("health/audit") @Roles("Admin")
  audit() { return this.svc.runFreshnessAudit(); }

  @Get("leaderboard")
  leaderboard(@CurrentUser("roles") roles: string[]) { requireStaff(roles); return this.svc.leaderboard(); }

  @Get("service-lines")
  serviceLines(@CurrentUser("roles") roles: string[]) { requireStaff(roles); return this.svc.serviceLines(); }

  @Get("lifecycles")
  lifecycles(@CurrentUser("roles") roles: string[]) { requireStaff(roles); return this.svc.lifecycles(); }

  @Get("simulator/incidents")
  simulatorIncidents(@CurrentUser("roles") roles: string[]) { requireStaff(roles); return this.svc.simulatorIncidents(); }

  @Get("simulator/:incidentRef")
  simulate(@CurrentUser("roles") roles: string[], @Param("incidentRef") ref: string) {
    requireStaff(roles);
    return this.svc.simulate(ref);
  }

  @Get("suggestions")
  suggestions(@CurrentUser("roles") roles: string[], @Query() q: PortalArticleQueryDto) {
    return this.svc.suggestions(q.q, isStaff(roles));
  }

  /** Self-service Knowledge Base: open to every signed-in user, limited to articles written for everyone. */
  @Get("portal/articles")
  portalList(@Query() q: PortalArticleQueryDto) { return this.svc.portalList(q.q); }

  @Get("portal/articles/:id")
  portalOne(@Param("id", ParseIntPipe) id: number) { return this.svc.portalFindOne(id); }

  /** Articles already linked to one ticket (incident id or INC code). */
  @Get("incidents/:incidentRef/links")
  incidentLinks(@CurrentUser("roles") roles: string[], @Param("incidentRef") ref: string) {
    requireStaff(roles);
    return this.svc.incidentLinks(ref);
  }

  @Get("articles")
  list(@CurrentUser("roles") roles: string[], @Query() q: KnowledgeArticleQueryDto) { requireStaff(roles); return this.svc.list(q); }

  @Get("articles/:id")
  findOne(@CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number) { requireStaff(roles); return this.svc.findOne(id); }

  @Get("articles/:id/attachments")
  attachments(@CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number) {
    return isStaff(roles) ? this.svc.listAttachments(id) : this.svc.listPortalAttachments(id);
  }

  @Post("articles/:id/attachments")
  @Roles("Fulfiller")
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: UPLOADS_ROOT,
      filename: (_req, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase();
      if (KNOWLEDGE_FILE_TYPES[extension] !== file.mimetype) {
        callback(new BadRequestException("Unsupported file type. Use PDF, DOCX, XLSX, TXT, PNG, or JPG files."), false);
        return;
      }
      callback(null, true);
    },
  }))
  async uploadAttachment(
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    requireStaff(roles);
    if (!file) throw new BadRequestException("Select a file to upload.");
    try {
      return await this.svc.addAttachment(id, userId, file);
    } catch (error) {
      await unlink(file.path);
      throw error;
    }
  }

  @Get("articles/:id/attachments/:attachmentId/download")
  async downloadAttachment(
    @CurrentUser("roles") roles: string[],
    @Param("id", ParseIntPipe) id: number,
    @Param("attachmentId", ParseIntPipe) attachmentId: number,
  ) {
    const attachment = isStaff(roles)
      ? await this.svc.getAttachment(id, attachmentId)
      : await this.svc.getPortalAttachment(id, attachmentId);
    const filePath = join(UPLOADS_ROOT, attachment.storageName);
    if (!existsSync(filePath)) throw new BadRequestException("The stored attachment file is unavailable.");
    return new StreamableFile(createReadStream(filePath), {
      type: attachment.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    });
  }

  @Delete("articles/:id/attachments/:attachmentId")
  async deleteAttachment(
    @CurrentUser("roles") roles: string[],
    @Param("id", ParseIntPipe) id: number,
    @Param("attachmentId", ParseIntPipe) attachmentId: number,
  ) {
    requireStaff(roles);
    const attachment = await this.svc.getAttachment(id, attachmentId);
    const filePath = join(UPLOADS_ROOT, attachment.storageName);
    if (existsSync(filePath)) await unlink(filePath);
    await this.svc.removeAttachment(id, attachmentId);
    return { deleted: true };
  }

  @Post("articles")
  create(
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Body() dto: CreateKnowledgeArticleDto,
  ) {
    requireStaff(roles);
    return this.svc.create(userId, dto);
  }

  @Patch("articles/:id")
  update(
    @CurrentUser("roles") roles: string[],
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateKnowledgeArticleDto,
  ) {
    requireStaff(roles);
    return this.svc.update(id, dto);
  }

  @Patch("articles/:id/workaround")
  setWorkaround(@CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number, @Body() dto: WorkaroundStatusDto) {
    requireStaff(roles);
    return this.svc.setWorkaroundStatus(id, dto.status);
  }

  @Post("articles/:id/review")
  review(@CurrentUser("roles") roles: string[], @Param("id", ParseIntPipe) id: number) {
    requireStaff(roles);
    return this.svc.markReviewed(id);
  }

  /** reference = staff reused it on a ticket; deflection / helpful / unhelpful may come from the portal. */
  @Post("articles/:id/events")
  event(
    @CurrentUser("userId") userId: number,
    @CurrentUser("roles") roles: string[],
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: KnowledgeEventDto,
  ) {
    if (dto.type === "reference") requireStaff(roles);
    return this.svc.recordEvent(id, userId ?? null, dto, isStaff(roles));
  }
}
