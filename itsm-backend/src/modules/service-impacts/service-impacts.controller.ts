import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { CreateServiceImpactDto, UpdateServiceImpactDto } from "./dto/service-impact.dto";
import { ServiceImpactsService } from "./service-impacts.service";

@ApiTags("service-impacts") @ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("service-impacts")
export class ServiceImpactsController {
  constructor(private readonly service: ServiceImpactsService) {}
  @Post() @Roles("Admin") create(@Body() dto: CreateServiceImpactDto) { return this.service.create(dto); }
  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateServiceImpactDto) { return this.service.update(id, dto); }
  @Delete(":id") @Roles("Admin") remove(@Param("id", ParseIntPipe) id: number) { return this.service.remove(id); }
}