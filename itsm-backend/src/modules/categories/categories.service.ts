import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Category } from "./entities/category.entity";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private categoriesRepo: Repository<Category>
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    const parent = await this.resolveParent(dto.parentCategoryId);

    const category = this.categoriesRepo.create({
      categoryName: dto.categoryName,
      description: dto.description,
      isActive: dto.isActive ?? true,
      parent,
    });

    return this.categoriesRepo.save(category);
  }

  /** Returns top-level categories with their immediate children eager-loaded (for a tree UI). */
  findAll(): Promise<Category[]> {
    return this.categoriesRepo.find({
      where: { parent: undefined },
      relations: { children: true },
      order: { categoryId: "ASC" },
    });
  }

  async findOne(categoryId: number): Promise<Category> {
    const category = await this.categoriesRepo.findOne({
      where: { categoryId },
      relations: { parent: true, children: true },
    });
    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }
    return category;
  }

  async update(
    categoryId: number,
    dto: UpdateCategoryDto
  ): Promise<Category> {
    const category = await this.findOne(categoryId);

    if (dto.parentCategoryId === categoryId) {
      throw new BadRequestException("A category cannot be its own parent");
    }

    const { parentCategoryId, ...rest } = dto;
    Object.assign(category, rest);

    if (parentCategoryId !== undefined) {
      category.parent = await this.resolveParent(parentCategoryId);
    }

    return this.categoriesRepo.save(category);
  }

  async remove(categoryId: number): Promise<void> {
    const category = await this.findOne(categoryId);
    await this.categoriesRepo.remove(category);
  }

  private async resolveParent(
    parentCategoryId?: number
  ): Promise<Category | null> {
    if (!parentCategoryId) return null;
    const parent = await this.categoriesRepo.findOne({
      where: { categoryId: parentCategoryId },
    });
    if (!parent) {
      throw new NotFoundException(
        `Parent category ${parentCategoryId} not found`
      );
    }
    return parent;
  }
}
