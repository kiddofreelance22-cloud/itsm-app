import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { CreateDirectorySourceDto, DirectorySourceDto, SaveAttributeMappingsDto } from "./dto/itsm-config.dto";
import { DirectoryService } from "./directory.service";

@ApiTags("directory") @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles("Admin") @Controller("directory")
export class DirectoryController {
  constructor(private readonly svc: DirectoryService) {}

  @Get("sources") list() { return this.svc.list(); }
  @Post("sources") create(@Body() dto: CreateDirectorySourceDto) { return this.svc.create(dto); }
  @Patch("sources/:id") update(@Param("id", ParseIntPipe) id: number, @Body() dto: DirectorySourceDto) { return this.svc.update(id, dto); }
  @Delete("sources/:id") remove(@Param("id", ParseIntPipe) id: number) { return this.svc.remove(id); }
  @Post("sources/:id/test") test(@Param("id", ParseIntPipe) id: number) { return this.svc.test(id); }

  @Roles("Admin", "Resolver", "End User")
  @Get("custom-attributes")
  customAttributes() {
    return this.svc.getActiveCustomAttributes();
  }

  @Get("sources/:id/mappings") mappings(@Param("id", ParseIntPipe) id: number) { return this.svc.getMappings(id); }
  @Put("sources/:id/mappings") saveMappings(@Param("id", ParseIntPipe) id: number, @Body() dto: SaveAttributeMappingsDto) {
    return this.svc.saveMappings(id, dto);
  }

  @Get("sources/:id/history") history(@Param("id", ParseIntPipe) id: number) { return this.svc.history(id); }
  @Post("sources/:id/sync") sync(@Param("id", ParseIntPipe) id: number, @CurrentUser("username") username: string) {
    return this.svc.syncNow(id, username ?? "admin");
  }
}
