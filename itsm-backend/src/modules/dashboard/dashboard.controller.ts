import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get("analyst")
  getAnalystDashboard(
    @CurrentUser("userId") userId: number,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.svc.getAnalystStats(
      userId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
