import {
  BadRequestException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Post, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { randomUUID } from "crypto";
import { promises as fs, createReadStream } from "fs";
import { join, resolve, sep } from "path";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Incident } from "../incidents/entities/incident.entity";
import { IncidentAttachment } from "./entities/incident-record.entities";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PER_INCIDENT = 10;
// Private folder — deliberately NOT under /uploads, which the app serves publicly without auth.
const ROOT = resolve(process.env.ATTACHMENTS_DIR || join(process.cwd(), "private-uploads", "incidents"));

/** Allowed types: extension → [mime, magic-byte check]. The file's real bytes must match, not just its name. */
const TYPES: Record<string, { mime: string; magic: (b: Buffer) => boolean }> = {
  jpg: { mime: "image/jpeg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  jpeg: { mime: "image/jpeg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  png: { mime: "image/png", magic: (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  pdf: { mime: "application/pdf", magic: (b) => b.slice(0, 5).toString("latin1") === "%PDF-" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 },
};

const STAFF = ["Admin", "Administrator", "Fulfiller", "IT Agent", "IT Manager", "Service Desk", "Engineer", "Agent"];

@ApiTags("incident-attachments") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("incidents")
export class IncidentAttachmentsController {
  constructor(
    @InjectRepository(Incident) private incidents: Repository<Incident>,
    @InjectRepository(IncidentAttachment) private repo: Repository<IncidentAttachment>,
  ) {}

  /** The requester and staff may touch an incident's attachments; nobody else. */
  private async authorise(ref: string, userId: number, roles: string[]): Promise<Incident> {
    const i = await this.incidents.findOne({ where: [{ incidentId: ref }, { incidentCode: ref }], relations: { createdBy: true } });
    if (!i) throw new NotFoundException(`Incident ${ref} not found`);
    const staff = (roles ?? []).some((r) => STAFF.includes(r));
    if (!staff && i.createdBy?.userId !== userId) throw new ForbiddenException("You don't have access to this incident.");
    return i;
  }

  private row(a: IncidentAttachment) {
    return { attachmentId: a.attachmentId, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes, uploadedAt: a.uploadedAt, uploadedBy: a.uploadedBy };
  }

  @Get(":id/attachments")
  async list(@Param("id") id: string, @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[]) {
    const i = await this.authorise(id, userId, roles);
    return (await this.repo.find({ where: { incidentId: i.incidentId }, order: { attachmentId: "ASC" } })).map((a) => this.row(a));
  }

  @Post(":id/attachments")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }))
  async upload(
    @Param("id") id: string, @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[],
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const i = await this.authorise(id, userId, roles);
    if (["Closed", "Cancelled"].includes(i.status)) throw new BadRequestException("This incident is closed; attachments can no longer be added.");
    if (!file) throw new BadRequestException("No file received (field name must be 'file').");
    const ext = (file.originalname.split(".").pop() ?? "").toLowerCase();
    const t = TYPES[ext];
    if (!t) throw new BadRequestException("Unsupported file type. Allowed: jpg, png, pdf, docx.");
    if (!file.size) throw new BadRequestException("The file is empty.");
    if (!t.magic(file.buffer)) throw new BadRequestException(`That file doesn't look like a real .${ext} file.`);
    if ((await this.repo.count({ where: { incidentId: i.incidentId } })) >= MAX_PER_INCIDENT) {
      throw new BadRequestException(`An incident can have at most ${MAX_PER_INCIDENT} attachments.`);
    }
    const dir = join(ROOT, i.incidentId.replace(/[^A-Za-z0-9_-]/g, "_"));
    await fs.mkdir(dir, { recursive: true });
    const stored = `${randomUUID()}.${ext}`;              // never trust the client's file name on disk
    await fs.writeFile(join(dir, stored), file.buffer, { flag: "wx" });
    const safeName = file.originalname.replace(/[\\/\r\n"]/g, "_").slice(0, 200);
    const saved = await this.repo.save(this.repo.create({
      incidentId: i.incidentId, fileName: safeName, mimeType: t.mime, sizeBytes: file.size, storagePath: join(i.incidentId.replace(/[^A-Za-z0-9_-]/g, "_"), stored), uploadedBy: userId,
    }));
    return this.row(saved);
  }

  @Get(":id/attachments/:attachmentId/download")
  async download(
    @Param("id") id: string, @Param("attachmentId", ParseIntPipe) attachmentId: number,
    @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[], @Res() res: Response,
  ) {
    const i = await this.authorise(id, userId, roles);
    const a = await this.repo.createQueryBuilder("a").addSelect("a.storagePath").where("a.attachmentId = :attachmentId AND a.incidentId = :iid", { attachmentId, iid: i.incidentId }).getOne();
    if (!a) throw new NotFoundException("Attachment not found");
    const full = resolve(ROOT, a.storagePath);
    if (!full.startsWith(ROOT + sep)) throw new ForbiddenException();        // path-traversal guard
    try { await fs.access(full); } catch { throw new NotFoundException("The stored file is missing."); }
    res.setHeader("Content-Type", a.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(a.fileName)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    createReadStream(full).pipe(res);
  }

  @Delete(":id/attachments/:attachmentId")
  async remove(@Param("id") id: string, @Param("attachmentId", ParseIntPipe) attachmentId: number, @CurrentUser("userId") userId: number, @CurrentUser("roles") roles: string[]) {
    const i = await this.authorise(id, userId, roles);
    if (["Closed", "Cancelled"].includes(i.status)) throw new BadRequestException("This incident is closed.");
    const a = await this.repo.createQueryBuilder("a").addSelect("a.storagePath").where("a.attachmentId = :attachmentId AND a.incidentId = :iid", { attachmentId, iid: i.incidentId }).getOne();
    if (!a) throw new NotFoundException("Attachment not found");
    const staff = (roles ?? []).some((r) => STAFF.includes(r));
    if (!staff && a.uploadedBy !== userId) throw new ForbiddenException("You can only remove files you uploaded.");
    const full = resolve(ROOT, a.storagePath);
    if (full.startsWith(ROOT + sep)) await fs.unlink(full).catch(() => undefined);
    await this.repo.remove(a);
    return { deleted: true };
  }
}
