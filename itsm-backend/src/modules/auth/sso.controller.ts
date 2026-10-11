import { Body, Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { IsString, MaxLength } from "class-validator";
import { SsoService } from "./sso.service";

class ExchangeDto { @IsString() @MaxLength(200) code!: string; }
const frontend = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
const cookieOf = (req: Request, name: string) => (req.headers.cookie ?? "").split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="))?.slice(name.length + 1);

/** Public by design: these run before the user has a token. */
@ApiTags("sso") @Controller("auth/sso")
export class SsoController {
  constructor(private readonly sso: SsoService) {}

  @Get("azure/config")
  async config() { return { enabled: await this.sso.isEnabled() }; }

  @Get("azure/start")
  async start(@Res() res: Response) {
    try {
      const { url, cookieNonce } = await this.sso.start();
      res.cookie("sso_nonce", cookieNonce, { httpOnly: true, sameSite: "lax", secure: frontend().startsWith("https"), maxAge: 10 * 60 * 1000, path: "/auth/sso" });
      res.redirect(url);
    } catch (e) { res.redirect(`${frontend()}/login?sso_error=${encodeURIComponent((e as Error).message)}`); }
  }

  @Get("azure/callback")
  async callback(@Query("code") code: string, @Query("state") state: string, @Query("error_description") err: string, @Req() req: Request, @Res() res: Response) {
    res.clearCookie("sso_nonce", { path: "/auth/sso" });
    if (err || !code || !state) return res.redirect(`${frontend()}/login?sso_error=${encodeURIComponent(err || "Microsoft sign-in was cancelled.")}`);
    try {
      const one = await this.sso.callback(code, state, cookieOf(req, "sso_nonce"));
      res.redirect(`${frontend()}/login?sso_code=${one}`);
    } catch (e) { res.redirect(`${frontend()}/login?sso_error=${encodeURIComponent((e as Error).message)}`); }
  }

  @Post("exchange")
  exchange(@Body() dto: ExchangeDto) { return this.sso.exchange(dto.code); }
}
