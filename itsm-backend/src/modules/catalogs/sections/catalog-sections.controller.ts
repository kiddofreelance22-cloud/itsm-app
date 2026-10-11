import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../../common/pipes/parse-int.pipe";
import { CatalogSectionsService } from "./catalog-sections.service";
import { CreateCatalogSectionDto } from "../dto/create-catalog-section.dto";
import { UpdateCatalogSectionDto } from "../dto/update-catalog-section.dto";
import { ReorderSectionsDto } from "../dto/reorder-sections.dto";

@ApiTags("catalog-sections")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("catalogs/:catalogId/sections")
export class CatalogSectionsController {
  constructor(private readonly sectionsService: CatalogSectionsService) {}

  @Get()
  findAll(@Param("catalogId", ParseIntPipe) catalogId: number) {
    return this.sectionsService.findAll(catalogId);
  }

  @Post()
  @Roles("Admin")
  create(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Body() dto: CreateCatalogSectionDto
  ) {
    return this.sectionsService.create(catalogId, dto);
  }

  @Patch("reorder")
  @Roles("Admin")
  reorder(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Body() dto: ReorderSectionsDto
  ) {
    return this.sectionsService.reorder(catalogId, dto);
  }

  @Patch(":sectionId")
  @Roles("Admin")
  update(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Param("sectionId", ParseIntPipe) sectionId: number,
    @Body() dto: UpdateCatalogSectionDto
  ) {
    return this.sectionsService.update(catalogId, sectionId, dto);
  }

  @Delete(":sectionId")
  @Roles("Admin")
  remove(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Param("sectionId", ParseIntPipe) sectionId: number
  ) {
    return this.sectionsService.remove(catalogId, sectionId);
  }
}
