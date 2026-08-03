import { Controller, Post, UseGuards, Body, Get } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { ResetTempPasswordDto } from "./dto/reset-temp-password.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";

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
      phone: fullUser.phone,
      roles: user.roles,
    };
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
