import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Verifies the Bearer JWT on the request via JwtStrategy.
 * Apply with @UseGuards(JwtAuthGuard) on any protected controller/route.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
