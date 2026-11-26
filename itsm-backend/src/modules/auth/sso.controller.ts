import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import type { CallbackParamsType } from "openid-client";
import { SsoProvider } from "./entities/user-identity.entity";
import { SsoFlowError, SsoService } from "./sso.service";

class ExchangeDto {
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  @Matches(/^[0-9a-f]{64}$/)
  code!: string;
}

const isProvider = (value: string): value is SsoProvider =>
  value === "google" || value === "microsoft";

const cookieOf = (req: Request, name: string): string | undefined =>
  req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);

@ApiTags("sso")
@Controller("auth")
export class SsoController {
  constructor(
    private readonly sso: SsoService,
    private readonly config: ConfigService,
  ) {}

  @Get("sso/providers")
  providers() {
    return { providers: this.sso.providers() };
  }

  @Get(":provider/login")
  async login(
    @Param("provider") providerName: string,
    @Res() response: Response,
  ): Promise<void> {
    const frontend = this.sso.frontendUrl();
    if (!isProvider(providerName)) {
      this.sso.logFailure(providerName);
      response.redirect(`${frontend}/login?error=sso_failed`);
      return;
    }

    try {
      const { url, cookie } = await this.sso.start(providerName);
      response.cookie(this.sso.cookieName(providerName), cookie, {
        httpOnly: true,
        sameSite: "lax",
        secure: this.sso.secureCookie(),
        maxAge: 10 * 60 * 1000,
        path: this.callbackPath(providerName),
      });
      response.redirect(url);
    } catch (error) {
      this.sso.logFailure(providerName, this.sso.errorCode(error));
      response.redirect(`${frontend}/login?error=${this.sso.errorCode(error)}`);
    }
  }

  @Get(":provider/callback")
  async callback(
    @Param("provider") providerName: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("iss") issuer: string | undefined,
    @Query("error") providerError: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const frontend = this.sso.frontendUrl();
    if (!isProvider(providerName)) {
      this.sso.logFailure(providerName);
      response.redirect(`${frontend}/login?error=sso_failed`);
      return;
    }

    response.clearCookie(this.sso.cookieName(providerName), {
      httpOnly: true,
      sameSite: "lax",
      secure: this.sso.secureCookie(),
      path: this.callbackPath(providerName),
    });

    const params: CallbackParamsType = {
      code,
      state,
      iss: issuer,
      error: providerError,
      error_description: errorDescription,
    };
    try {
      const loginCode = await this.sso.callback(
        providerName,
        params,
        cookieOf(request, this.sso.cookieName(providerName)),
      );
      response.redirect(
        `${frontend}/auth/callback?code=${encodeURIComponent(loginCode)}`,
      );
    } catch (error) {
      const errorCode = this.sso.errorCode(error);
      response.redirect(`${frontend}/login?error=${errorCode}`);
    }
  }

  @Post("sso/exchange")
  exchange(@Body() dto: ExchangeDto) {
    try {
      return this.sso.exchange(dto.code);
    } catch (error) {
      if (!(error instanceof SsoFlowError)) {
        throw error;
      }
      throw new BadRequestException({
        code: this.sso.errorCode(error),
        message: "The sign-in code is invalid or expired.",
      });
    }
  }

  private callbackPath(provider: SsoProvider): string {
    const backendUrl = this.config.get<string>("sso.backendUrl");
    const basePath = backendUrl ? new URL(backendUrl).pathname.replace(/\/+$/, "") : "";
    return `${basePath}/auth/${provider}/callback`;
  }
}
