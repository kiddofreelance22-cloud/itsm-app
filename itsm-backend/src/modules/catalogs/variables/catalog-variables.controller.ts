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
import { CatalogVariablesService } from "./catalog-variables.service";
import { CreateCatalogVariableDto } from "../dto/create-catalog-variable.dto";
import { UpdateCatalogVariableDto } from "../dto/update-catalog-variable.dto";
import { ReorderVariablesDto } from "../dto/reorder-variables.dto";

@ApiTags("catalog-variables")
@ApiBearerAuth()
@Controller("catalogs/:catalogId/variables")
export class CatalogVariablesController {
  constructor(private readonly variablesService: CatalogVariablesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  create(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Body() dto: CreateCatalogVariableDto
  ) {
    return this.variablesService.create(catalogId, dto);
  }

  // Public-to-authenticated-users: needed to render the request submission form
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Param("catalogId", ParseIntPipe) catalogId: number) {
    return this.variablesService.findAllForCatalog(catalogId);
  }

  @Patch("reorder")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  reorder(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Body() dto: ReorderVariablesDto
  ) {
    return this.variablesService.reorder(catalogId, dto);
  }

  @Get(":variableId")
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Param("variableId", ParseIntPipe) variableId: number
  ) {
    return this.variablesService.findOne(catalogId, variableId);
  }

  @Patch(":variableId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  update(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Param("variableId", ParseIntPipe) variableId: number,
    @Body() dto: UpdateCatalogVariableDto
  ) {
    return this.variablesService.update(catalogId, variableId, dto);
  }

  @Delete(":variableId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  remove(
    @Param("catalogId", ParseIntPipe) catalogId: number,
    @Param("variableId", ParseIntPipe) variableId: number
  ) {
    return this.variablesService.remove(catalogId, variableId);
  }
}
