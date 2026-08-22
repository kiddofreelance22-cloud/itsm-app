import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike, IsNull } from "typeorm";
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
    const subCategoryName = dto.subCategoryName.trim();

    // Same sub-category name shouldn't repeat under the same parent category
    // (case-insensitive) even if the code entered differs.
    const nameConflict = await this.repo.findOne({
      where: {
        subCategoryName: ILike(subCategoryName),
        category: dto.categoryId ? { categoryId: dto.categoryId } : IsNull(),
      },
      relations: { category: true },
    });
    if (nameConflict) throw new ConflictException(`Sub-category "${subCategoryName}" already exists under this category`);

    const exists = await this.repo.findOne({ where: { subCategoryCode: dto.subCategoryCode } });
    if (exists) throw new ConflictException(`Code "${dto.subCategoryCode}" already exists`);
    const { categoryId, ...rest } = dto;
    const subCategory = this.repo.create({ ...rest, subCategoryName });
    if (categoryId) {
      const category = await this.catRepo.findOne({ where: { categoryId } });
      if (!category) throw new NotFoundException(`Category ${categoryId} not found`);
      subCategory.category = category;
    }
    return this.repo.save(subCategory);
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

    const newCategoryId = categoryId !== undefined ? categoryId : e.category?.categoryId;
    const newName = (rest.subCategoryName ?? e.subCategoryName).trim();
    if (rest.subCategoryName !== undefined || categoryId !== undefined) {
      const conflict = await this.repo.findOne({
        where: {
          subCategoryName: ILike(newName),
          category: newCategoryId ? { categoryId: newCategoryId } : IsNull(),
        },
        relations: { category: true },
      });
      if (conflict && conflict.subCategoryId !== id)
        throw new ConflictException(`Sub-category "${newName}" already exists under this category`);
    }
    if (rest.subCategoryName !== undefined) rest.subCategoryName = newName;

    if (dto.subCategoryCode && dto.subCategoryCode !== e.subCategoryCode) {
      const codeConflict = await this.repo.findOne({ where: { subCategoryCode: dto.subCategoryCode } });
      if (codeConflict && codeConflict.subCategoryId !== id)
        throw new ConflictException(`Code "${dto.subCategoryCode}" already exists`);
    }

    if (categoryId !== undefined) {
      e.category = categoryId
        ? (await this.catRepo.findOne({ where: { categoryId } }) ?? undefined)
        : undefined;
    }
    Object.assign(e, rest);
    return this.repo.save(e);
  }

  async remove(id: number): Promise<void> {
    const e = await this.findOne(id);
    await this.repo.remove(e);
  }
}
