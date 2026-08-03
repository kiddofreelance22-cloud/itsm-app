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
import { CurrentUser } from "../../common/decorators/current-user.decorator";

import { IncidentsService } from "./incidents.service";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";

@ApiTags("incidents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  create(
    @CurrentUser("userId") userId: number,
    @Body() dto: CreateIncidentDto
  ) {
    return this.incidentsService.create(userId, dto);
  }

  @Get("mine")
  findMine(@CurrentUser("userId") userId: number) {
    return this.incidentsService.findAllForUser(userId);
  }

  @Get()
  @Roles("Admin", "Fulfiller")
  findAll() {
    return this.incidentsService.findAll();
  }

  @Get(":incidentId")
  findOne(@Param("incidentId") incidentId: string) {
    return this.incidentsService.findOne(incidentId);
  }

  @Patch(":incidentId")
  @Roles("Admin", "Fulfiller")
  update(
    @Param("incidentId") incidentId: string,
    @Body() dto: UpdateIncidentDto
  ) {
    return this.incidentsService.update(incidentId, dto);
  }

  @Delete(":incidentId")
  @Roles("Admin")
  remove(@Param("incidentId") incidentId: string) {
    return this.incidentsService.remove(incidentId);
  }
}
