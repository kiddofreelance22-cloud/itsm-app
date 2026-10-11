import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { ParseIntPipe } from "../../common/pipes/parse-int.pipe";
import { DepartmentsService } from "./departments.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

@ApiTags("departments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles("Admin")
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(":departmentId")
  findOne(@Param("departmentId", ParseIntPipe) departmentId: number) {
    return this.departmentsService.findOne(departmentId);
  }

  @Patch(":departmentId")
  @Roles("Admin")
  update(
    @Param("departmentId", ParseIntPipe) departmentId: number,
    @Body() dto: UpdateDepartmentDto
  ) {
    return this.departmentsService.update(departmentId, dto);
  }

  @Delete(":departmentId")
  @Roles("Admin")
  remove(@Param("departmentId", ParseIntPipe) departmentId: number) {
    return this.departmentsService.remove(departmentId);
  }
}
