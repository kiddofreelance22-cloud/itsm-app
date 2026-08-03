import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { RequestsService } from "./requests.service";
import { CreateRequestDto } from "./dto/create-request.dto";

@ApiTags("requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("requests")
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  /** Request Submission screen action */
  @Post()
  create(@CurrentUser("userId") userId: number, @Body() dto: CreateRequestDto) {
    return this.requestsService.create(userId, dto);
  }

  /** "My requests" list for the logged-in requester */
  @Get("mine")
  findMine(@CurrentUser("userId") userId: number) {
    return this.requestsService.findAllForUser(userId);
  }

  @Get()
  @Roles("Admin")
  findAll() {
    return this.requestsService.findAll();
  }

  @Get(":requestId")
  findOne(@Param("requestId", ParseIntPipe) requestId: number) {
    return this.requestsService.findOne(requestId);
  }
}
