import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Triggers LocalStrategy.validate() using the request body's username/password. */
@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {}
