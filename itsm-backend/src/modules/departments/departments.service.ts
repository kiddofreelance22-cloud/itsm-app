import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { uniqueCode } from "../../common/utils/code.util";
import { Department } from "./entities/department.entity";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private departmentsRepo: Repository<Department>,
  ) {}

  async create(dto: CreateDepartmentDto): Promise<Department> {
    if (!dto.departmentCode) dto.departmentCode = await uniqueCode(this.departmentsRepo, "departmentCode", dto.departmentName);
    const department = this.departmentsRepo.create(dto as any) as unknown as Department;
    return this.departmentsRepo.save(department);
  }

  findAll(): Promise<Department[]> {
    return this.departmentsRepo.find({
      order: { departmentName: "ASC" },
    });
  }

  async findOne(departmentId: number): Promise<Department> {
    const department = await this.departmentsRepo.findOne({
      where: { departmentId },
    });
    if (!department) {
      throw new NotFoundException(`Department ${departmentId} not found`);
    }
    return department;
  }

  async update(departmentId: number, dto: UpdateDepartmentDto): Promise<Department> {
    const department = await this.findOne(departmentId);
    Object.assign(department, dto);
    return this.departmentsRepo.save(department);
  }

  async remove(departmentId: number): Promise<void> {
    const department = await this.findOne(departmentId);
    await this.departmentsRepo.remove(department);
  }
}
