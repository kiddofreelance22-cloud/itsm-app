import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from "./dto/service-category.dto";
import { ServiceCategoriesService } from "./service-categories.service";

@ApiTags("service-categories") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("service-categories")
export class ServiceCategoriesController {
  constructor(private readonly service: ServiceCategoriesService) {}
  @Post() @Roles("Admin") create(@Body() dto: CreateServiceCategoryDto) { return this.service.create(dto); }
  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateServiceCategoryDto) { return this.service.update(id, dto); }
  @Delete(":id") @Roles("Admin") remove(@Param("id", ParseIntPipe) id: number) { return this.service.remove(id); }
}