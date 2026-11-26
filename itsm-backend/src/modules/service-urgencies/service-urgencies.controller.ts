import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { CreateServiceUrgencyDto, UpdateServiceUrgencyDto } from "./dto/service-urgency.dto";
import { ServiceUrgenciesService } from "./service-urgencies.service";

@ApiTags("service-urgencies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("service-urgencies")
export class ServiceUrgenciesController {
  constructor(private readonly service: ServiceUrgenciesService) {}

  @Post()
  @Roles("Admin")
  create(@Body() dto: CreateServiceUrgencyDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @Roles("Admin")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateServiceUrgencyDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @Roles("Admin")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
