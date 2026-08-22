import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@ApiTags("categories")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("categories")
export class CategoriesController {
  constructor(private readonly svc: CategoriesService) {}

  @Post()
  @Roles("Admin")
  create(@Body() dto: CreateCategoryDto) {
    return this.svc.create(dto);
  }

  /** All authenticated users can read categories */
  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Get(":categoryId")
  findOne(@Param("categoryId", ParseIntPipe) id: number) {
    return this.svc.findOne(id);
  }

  @Patch(":categoryId")
  @Roles("Admin")
  update(
    @Param("categoryId", ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto
  ) {
    return this.svc.update(id, dto);
  }

  @Patch(":categoryId/reorder")
  @Roles("Admin")
  reorder(
    @Param("categoryId", ParseIntPipe) id: number,
    @Body("displayOrder") newOrder: number
  ) {
    return this.svc.reorder(id, newOrder);
  }

  @Delete(":categoryId")
  @Roles("Admin")
  remove(@Param("categoryId", ParseIntPipe) id: number) {
    return this.svc.remove(id);
  }
}
