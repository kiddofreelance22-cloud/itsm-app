import { Controller, Post, UseGuards, Body, Get, ForbiddenException, Req } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { ResetTempPasswordDto } from "./dto/reset-temp-password.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { SwitchUserDto } from "./dto/switch-user.dto";
import { EndImpersonationDto } from "./dto/end-impersonation.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * LocalAuthGuard runs LocalStrategy.validate(username, password) from the
   * request body, attaches the result to req.user, then this handler issues the JWT.
   */
  @UseGuards(LocalAuthGuard)
  @Post("login")
  @ApiBody({ type: LoginDto })
  async login(@CurrentUser() user, @Body() _dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get("me")
  async me(@CurrentUser() user) {
    const fullUser = await this.authService.validateJwtUser(user.userId);
    return {
      userId: fullUser.userId,
      username: fullUser.username,
      email: fullUser.email,
      fullName: fullUser.fullName,
      profilePhotoUrl: fullUser.profilePhotoUrl,
      phone: fullUser.phone,
      roles: user.roles,
      impersonatedBy: user.impersonatedBy,
      impersonationId: user.impersonationId,
      expiresAt: user.expiresAt,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  @Post("switch-user")
  async switchUser(@CurrentUser() actor, @Body() dto: SwitchUserDto, @Req() req) {
    if (actor.impersonatedBy) throw new ForbiddenException("End the current support session before switching users.");
    return this.authService.switchUser(actor, dto.userId, req.ip, req.get("user-agent"));
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post("extend-impersonation")
  async extendImpersonation(@CurrentUser() user) {
    if (!user.impersonatedBy || !user.impersonationId) {
      throw new ForbiddenException("Only an active support session can be extended.");
    }
    return this.authService.extendImpersonation(user.userId, user.impersonationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  @Post("end-impersonation")
  async endImpersonation(@CurrentUser() user, @Body() dto: EndImpersonationDto) {
    if (user.impersonatedBy) throw new ForbiddenException("End the current support session from the administrator session.");
    await this.authService.endImpersonation(user.userId, dto.impersonationId);
    return { ended: true };
  }

  /** Accepts the temporary password and sets a new permanent password. */
  @Post("reset-temp-password")
  async resetTempPassword(@Body() dto: ResetTempPasswordDto): Promise<AuthResponseDto> {
    return this.authService.resetTempPassword(
      dto.email,
      dto.temporaryPassword,
      dto.newPassword,
    );
  }
}
