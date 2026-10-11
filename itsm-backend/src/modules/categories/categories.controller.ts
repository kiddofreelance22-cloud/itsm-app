import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { CategoriesService, CategoryDeletePolicy } from "./categories.service";
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

  /**
   * Full, deeply-nested category tree in a single atomic payload — the
   * client re-renders its whole tree from this response rather than
   * patching individual nodes, so a parent relocation (which re-derives
   * materialized paths for a whole subtree) can never leave the UI showing
   * a stale/partial hierarchy.
   */
  @Get("tree")
  findTree() {
    return this.svc.findTree();
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
  @ApiQuery({
    name: "policy", required: false, enum: ["cascade", "reparent"],
    description: "cascade = delete this node and everything nested under it. reparent (default) = delete only this node and shift its children up one level.",
  })
  remove(
    @Param("categoryId", ParseIntPipe) id: number,
    @Query("policy") policy?: string,
  ) {
    if (policy && policy !== "cascade" && policy !== "reparent") {
      throw new BadRequestException('policy must be "cascade" or "reparent"');
    }
    return this.svc.remove(id, (policy as CategoryDeletePolicy) ?? "reparent");
  }
}
