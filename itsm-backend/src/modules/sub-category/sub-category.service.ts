import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SubCategory } from "./entities/sub-category.entity";
import { Category } from "../categories/entities/category.entity";
import { CreateSubCategoryDto, UpdateSubCategoryDto } from "./dto/sub-category.dto";

@Injectable()
export class SubCategoryService {
  constructor(
    @InjectRepository(SubCategory) private repo: Repository<SubCategory>,
    @InjectRepository(Category) private catRepo: Repository<Category>,
  ) {}

  async create(dto: CreateSubCategoryDto): Promise<SubCategory> {
    const exists = await this.repo.findOne({ where: { subCategoryCode: dto.subCategoryCode } });
    if (exists) throw new ConflictException(`Code "${dto.subCategoryCode}" already exists`);
    let category: Category | null = null;
    if (dto.categoryId) {
      category = await this.catRepo.findOne({ where: { categoryId: dto.categoryId } });
      if (!category) throw new NotFoundException(`Category ${dto.categoryId} not found`);
    }
    const { categoryId, ...rest } = dto;
    return this.repo.save(this.repo.create({ ...rest, category }));
  }

  findAll(): Promise<SubCategory[]> {
    return this.repo.find({ relations: { category: true }, order: { subCategoryId: "ASC" } });
  }

  async findOne(id: number): Promise<SubCategory> {
    const e = await this.repo.findOne({ where: { subCategoryId: id }, relations: { category: true } });
    if (!e) throw new NotFoundException(`SubCategory ${id} not found`);
    return e;
  }

  async update(id: number, dto: UpdateSubCategoryDto): Promise<SubCategory> {
    const e = await this.findOne(id);
    const { categoryId, ...rest } = dto;
    if (categoryId !== undefined) {
      e.category = categoryId
        ? await this.catRepo.findOne({ where: { categoryId } }) : null;
    }
    Object.assign(e, rest);
    return this.repo.save(e);
  }

  async remove(id: number): Promise<void> {
    const e = await this.findOne(id);
    await this.repo.remove(e);
  }
}
