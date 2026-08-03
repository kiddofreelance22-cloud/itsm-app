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
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles("Admin")
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  // Readable by any authenticated user (needed for catalog browsing), not just Admin
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(":categoryId")
  findOne(@Param("categoryId", ParseIntPipe) categoryId: number) {
    return this.categoriesService.findOne(categoryId);
  }

  @Patch(":categoryId")
  @Roles("Admin")
  update(
    @Param("categoryId", ParseIntPipe) categoryId: number,
    @Body() dto: UpdateCategoryDto
  ) {
    return this.categoriesService.update(categoryId, dto);
  }

  @Delete(":categoryId")
  @Roles("Admin")
  remove(@Param("categoryId", ParseIntPipe) categoryId: number) {
    return this.categoriesService.remove(categoryId);
  }
}
