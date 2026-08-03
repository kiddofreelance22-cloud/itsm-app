import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { CatalogsService } from "./catalogs.service";
import { CreateCatalogDto } from "./dto/create-catalog.dto";
import { UpdateCatalogDto } from "./dto/update-catalog.dto";

@ApiTags("catalogs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("catalogs")
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Post()
  @Roles("Admin")
  create(@Body() dto: CreateCatalogDto) {
    return this.catalogsService.create(dto);
  }

  // Any authenticated user can browse the catalog; ?active=true is the default browsing view
  @Get()
  findAll(@Query("active") active?: string) {
    return active === "false"
      ? this.catalogsService.findAll()
      : this.catalogsService.findAllActive();
  }

  @Get(":catalogId")
  findOne(@Param("catalogId", ParseIntPipe) catalogId: number) {
    return this.catalogsService.findOne(catalogId);
  }

  @Patch(":catalogId")
  @Roles("Admin")
  update(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Body() dto: UpdateCatalogDto
  ) {
    return this.catalogsService.update(catalogId, dto);
  }

  @Delete(":catalogId")
  @Roles("Admin")
  remove(@Param("catalogId", ParseIntPipe) catalogId: number) {
    return this.catalogsService.remove(catalogId);
  }
}
