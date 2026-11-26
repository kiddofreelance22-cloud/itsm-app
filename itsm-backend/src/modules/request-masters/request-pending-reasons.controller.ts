import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { CreateRequestPendingReasonDto, UpdateRequestPendingReasonDto } from "./dto/request-pending-reason.dto";
import { RequestPendingReasonsService } from "./request-pending-reasons.service";

/** Hold reasons for service requests. Incidents keep using /pending-reasons. */
@ApiTags("request-pending-reasons") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller("request-pending-reasons")
export class RequestPendingReasonsController {
  constructor(private readonly service: RequestPendingReasonsService) {}
  @Post() @Roles("Admin") create(@Body() dto: CreateRequestPendingReasonDto) { return this.service.create(dto); }
  @Get() list() { return this.service.list(); }
  @Patch(":id") @Roles("Admin") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRequestPendingReasonDto) { return this.service.update(id, dto); }
  @Delete(":id") @Roles("Admin") remove(@Param("id", ParseIntPipe) id: number) { return this.service.remove(id); }
}
