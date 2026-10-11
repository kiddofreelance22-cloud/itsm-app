import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { IncidentConfigService } from "./incident-config.service";
import { UpdateFieldVisibilityDto } from "./dto/update-field-visibility.dto";

@ApiTags("incident-config")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class IncidentConfigController {
  constructor(private readonly service: IncidentConfigService) {}

  @Get("incidents/meta/field-visibility")
  async getIncidentFieldVisibility() {
    const fields = await this.service.findFieldVisibility();
    return { fields: fields.map(({ fieldName, section, visible, required }) => ({ fieldName, section, visible, required })) };
  }

  @Get("config/field-visibility")
  @Roles("Admin")
  async getConfigFieldVisibility() {
    return this.getIncidentFieldVisibility();
  }

  @Put("config/field-visibility")
  @Roles("Admin")
  async replaceFieldVisibility(@Body() dto: UpdateFieldVisibilityDto) {
    const fields = await this.service.replaceFieldVisibility(dto.fields);
    return { fields: fields.map(({ fieldName, section, visible, required }) => ({ fieldName, section, visible, required })) };
  }
}