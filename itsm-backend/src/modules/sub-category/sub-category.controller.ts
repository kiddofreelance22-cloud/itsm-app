import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { SubCategoryService } from "./sub-category.service";
import { CreateSubCategoryDto, UpdateSubCategoryDto } from "./dto/sub-category.dto";

@ApiTags("sub-category") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("sub-category")
export class SubCategoryController {
  constructor(private readonly svc: SubCategoryService) {}
  @Post() @Roles("Admin") create(@Body() dto: CreateSubCategoryDto) { return this.svc.create(dto); }
  @Get() findAll() { return this.svc.findAll(); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number) { return this.svc.findOne(id); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSubCategoryDto) { return this.svc.update(id, dto); }
  @Delete(":id") @Roles("Admin") remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }
}
