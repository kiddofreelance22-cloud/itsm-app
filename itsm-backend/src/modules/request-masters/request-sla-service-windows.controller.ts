import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { CreateSlaServiceWindowDto, UpdateSlaServiceWindowDto } from "./dto/request-masters.dto";
import { RequestSlaServiceWindowsService } from "./request-sla-service-windows.service";

/** SLA Service Windows for service requests. Incidents keep using /sla-service-windows. */
@ApiTags("request-sla-service-windows")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("request-sla-service-windows")
export class RequestSlaServiceWindowsController {
  constructor(private readonly service: RequestSlaServiceWindowsService) {}

  @Post()
  @Roles("Admin")
  create(@Body() dto: CreateSlaServiceWindowDto) {
    return this.service.create(dto);
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @Roles("Admin")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSlaServiceWindowDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @Roles("Admin")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
