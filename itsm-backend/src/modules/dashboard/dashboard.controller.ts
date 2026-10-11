import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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

  /** End user: only incidents the caller reported. */
  @Get("end-user")
  getEndUserDashboard(@CurrentUser("userId") userId: number) {
    return this.svc.getEndUserDashboard(userId);
  }

  /** Resolver / analyst: my queue, group queue, SLA attention. */
  @Get("resolver")
  @Roles("Fulfiller")
  getResolverDashboard(@CurrentUser("userId") userId: number) {
    return this.svc.getResolverDashboard(userId);
  }

  /** Admin: system-wide totals. */
  @Get("admin")
  @Roles("Admin")
  getAdminDashboard() {
    return this.svc.getAdminDashboard();
  }
}
