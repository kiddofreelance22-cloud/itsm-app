import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { randomUUID } from "crypto";
import { ApiTags, ApiBearerAuth, ApiConsumes } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UploadsService, UPLOADS_ROOT } from "./uploads.service";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

/**
 * Generic, reusable upload endpoint. Persists to local disk under
 * ./uploads and serves it back as a static /uploads/<file> URL (wired up in
 * main.ts) — never a filesystem path. Used by:
 *   - Catalog Item icon/banner (Item Details tab)
 *   - Catalog Attachments tab
 *   - the "Attachment" catalog variable type, for requesters filling out a
 *     request form
 * There's no per-feature upload table beyond that: catalog icon/banner store
 * the returned URL directly on the Catalog row, and Attachments/Attachment-
 * variable values store it via their own metadata rows so filename/size/
 * uploader can be tracked without duplicating the storage logic.
 */
@ApiTags("uploads")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: UPLOADS_ROOT,
        filename: (_req, file, cb) => {
          const unique = randomUUID();
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    })
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return {
      url: this.uploadsService.toPublicUrl(file.filename),
      fileName: file.originalname,
      contentType: file.mimetype,
      size: file.size,
    };
  }
}
