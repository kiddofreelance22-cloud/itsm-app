import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../../common/pipes/parse-int.pipe";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CatalogAttachmentsService } from "./catalog-attachments.service";

/**
 * Attachments are recorded here as metadata rows pointing at a file already
 * persisted through POST /uploads — the frontend uploads the file first
 * (getting back a /uploads/<file> URL), then calls this endpoint with that
 * URL plus the file's name/size/type to attach it to the catalog item. This
 * mirrors how the icon/banner and Attachment-type variables use the same
 * shared upload endpoint, instead of building a second file-upload pipeline
 * just for this tab.
 */
@ApiTags("catalog-attachments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("catalogs/:catalogId/attachments")
export class CatalogAttachmentsController {
  constructor(private readonly attachmentsService: CatalogAttachmentsService) {}

  @Get()
  findAll(@Param("catalogId", ParseIntPipe) catalogId: number) {
    return this.attachmentsService.findAll(catalogId);
  }

  @Post()
  @Roles("Admin")
  create(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Body() body: { fileName?: string; contentType?: string; size?: number; storagePath?: string },
    @CurrentUser("userId") userId: number
  ) {
    if (!body.fileName || !body.storagePath || body.size === undefined) {
      throw new BadRequestException("fileName, size and storagePath (from POST /uploads) are required");
    }
    return this.attachmentsService.create(
      catalogId,
      {
        fileName: body.fileName,
        contentType: body.contentType,
        size: body.size,
        storagePath: body.storagePath,
      },
      userId
    );
  }

  @Delete(":attachmentId")
  @Roles("Admin")
  remove(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Param("attachmentId", ParseIntPipe) attachmentId: number
  ) {
    return this.attachmentsService.remove(catalogId, attachmentId);
  }
}
