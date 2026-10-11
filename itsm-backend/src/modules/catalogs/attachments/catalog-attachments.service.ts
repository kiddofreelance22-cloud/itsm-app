import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { CatalogAttachment } from "../entities/catalog-attachment.entity";
import { Catalog } from "../entities/catalog.entity";
import { User } from "../../users/entities/user.entity";
import { UPLOADS_ROOT } from "../../uploads/uploads.service";

export interface CreateCatalogAttachmentInput {
  fileName: string;
  contentType?: string;
  size: number;
  storagePath: string; // e.g. "/uploads/<uuid>.pdf", as returned by UploadsController
}

@Injectable()
export class CatalogAttachmentsService {
  constructor(
    @InjectRepository(CatalogAttachment)
    private attachmentsRepo: Repository<CatalogAttachment>,
    @InjectRepository(Catalog) private catalogsRepo: Repository<Catalog>
  ) {}

  findAll(catalogId: number): Promise<CatalogAttachment[]> {
    return this.attachmentsRepo.find({
      where: { catalog: { catalogId } },
      relations: { createdBy: true },
      order: { createdAt: "DESC" },
    });
  }

  async create(
    catalogId: number,
    dto: CreateCatalogAttachmentInput,
    uploadedByUserId?: number
  ): Promise<CatalogAttachment> {
    const catalog = await this.catalogsRepo.findOne({ where: { catalogId } });
    if (!catalog) throw new NotFoundException(`Catalog ${catalogId} not found`);

    const attachment = this.attachmentsRepo.create({
      catalog,
      fileName: dto.fileName,
      contentType: dto.contentType,
      size: dto.size,
      storagePath: dto.storagePath,
      createdBy: uploadedByUserId ? ({ userId: uploadedByUserId } as User) : undefined,
    });
    return this.attachmentsRepo.save(attachment);
  }

  async remove(catalogId: number, attachmentId: number): Promise<void> {
    const attachment = await this.attachmentsRepo.findOne({
      where: { attachmentId, catalog: { catalogId } },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found on catalog ${catalogId}`);
    }

    // Best-effort disk cleanup — storagePath is always "/uploads/<file>".
    const filename = attachment.storagePath.replace(/^\/uploads\//, "");
    const diskPath = join(UPLOADS_ROOT, filename);
    if (existsSync(diskPath)) {
      try { unlinkSync(diskPath); } catch { /* non-fatal: metadata row is still removed */ }
    }

    await this.attachmentsRepo.remove(attachment);
  }
}
