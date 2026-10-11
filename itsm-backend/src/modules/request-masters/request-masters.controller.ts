import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { CreateClosureCodeDto, CreatePendingReasonDto, CreatePriorityMatrixDto, CreateSlaServiceWindowDto, UpdateClosureCodeDto, UpdatePendingReasonDto, UpdatePriorityMatrixDto, UpdateSlaServiceWindowDto } from "./dto/request-masters.dto";
import { RequestMastersService } from "./request-masters.service";
@ApiTags("request-masters") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller()
export class RequestMastersController {
  constructor(private readonly service: RequestMastersService) {}
  @Post("closure-codes") @Roles("Admin") createClosure(@Body() dto: CreateClosureCodeDto) { return this.service.createClosureCode(dto); }
  @Get("closure-codes") listClosure() { return this.service.listClosureCodes(); }
  @Patch("closure-codes/:id") @Roles("Admin") updateClosure(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateClosureCodeDto) { return this.service.updateClosureCode(id, dto); }
  @Delete("closure-codes/:id") @Roles("Admin") removeClosure(@Param("id", ParseIntPipe) id: number) { return this.service.removeClosureCode(id); }
  @Post("pending-reasons") @Roles("Admin") createPending(@Body() dto: CreatePendingReasonDto) { return this.service.createPendingReason(dto); }
  @Get("pending-reasons") listPending() { return this.service.listPendingReasons(); }
  @Patch("pending-reasons/:id") @Roles("Admin") updatePending(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePendingReasonDto) { return this.service.updatePendingReason(id, dto); }
  @Delete("pending-reasons/:id") @Roles("Admin") removePending(@Param("id", ParseIntPipe) id: number) { return this.service.removePendingReason(id); }
  @Post("priority-matrices") @Roles("Admin") createMatrix(@Body() dto: CreatePriorityMatrixDto) { return this.service.createPriorityMatrix(dto); }
  @Get("priority-matrices") listMatrix() { return this.service.listPriorityMatrices(); }
  @Patch("priority-matrices/:id") @Roles("Admin") updateMatrix(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdatePriorityMatrixDto) { return this.service.updatePriorityMatrix(id, dto); }
  @Delete("priority-matrices/:id") @Roles("Admin") removeMatrix(@Param("id", ParseIntPipe) id: number) { return this.service.removePriorityMatrix(id); }
  @Post("sla-service-windows") @Roles("Admin") createSla(@Body() dto: CreateSlaServiceWindowDto) { return this.service.createSlaWindow(dto); }
  @Get("sla-service-windows") listSla() { return this.service.listSlaWindows(); }
  @Patch("sla-service-windows/:id") @Roles("Admin") updateSla(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateSlaServiceWindowDto) { return this.service.updateSlaWindow(id, dto); }
  @Delete("sla-service-windows/:id") @Roles("Admin") removeSla(@Param("id", ParseIntPipe) id: number) { return this.service.removeSlaWindow(id); }
}