import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import { Category } from "./entities/category.entity";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private repo: Repository<Category>
  ) {}

  // ── CREATE ──────────────────────────────────────────────────────────────
  async create(dto: CreateCategoryDto): Promise<Category> {
    const categoryName = dto.categoryName.trim();

    // Name must be unique regardless of what code ends up being used
    // (case-insensitive, so "Hardware" and "hardware" are treated as duplicates)
    const nameConflict = await this.repo.findOne({ where: { categoryName: ILike(categoryName) } });
    if (nameConflict) throw new ConflictException(`Category "${categoryName}" already exists`);

    // Auto-generate code if not provided
    const code = dto.categoryCode
      ?? categoryName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

    const codeConflict = await this.repo.findOne({ where: { categoryCode: code } });
    if (codeConflict) throw new ConflictException(`Category code "${code}" is already in use`);

    // Auto-assign display order = max + 1 if not provided
    const displayOrder = dto.displayOrder ?? await this.nextDisplayOrder();

    const category = this.repo.create({
      categoryName:      categoryName,
      categoryCode:      code,
      description:       dto.description   ?? undefined,
      displayOrder,
      icon:              dto.icon          ?? undefined,
      isActive:          dto.isActive      ?? true,
      availableInPortal: dto.availableInPortal ?? true,
      availableInMobile: dto.availableInMobile ?? true,
      showInCatalog:     dto.showInCatalog    ?? true,
      allowInIncident:   dto.allowInIncident  ?? true,
    });

    if (dto.parentCategoryId) {
      category.parent = await this.resolveParent(dto.parentCategoryId) || undefined;
    }

    return this.repo.save(category);
  }

  // ── READ ────────────────────────────────────────────────────────────────
  findAll(): Promise<Category[]> {
    return this.repo.find({
      relations: { parent: true, children: true },
      order: { displayOrder: "ASC", categoryId: "ASC" },
    });
  }

  async findOne(categoryId: number): Promise<Category> {
    const cat = await this.repo.findOne({
      where: { categoryId },
      relations: { parent: true, children: true },
    });
    if (!cat) throw new NotFoundException(`Category ${categoryId} not found`);
    return cat;
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────
  async update(categoryId: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(categoryId);

    if (dto.parentCategoryId === categoryId)
      throw new BadRequestException("A category cannot be its own parent");

    if (dto.categoryName && dto.categoryName.trim().toLowerCase() !== category.categoryName.toLowerCase()) {
      const nameConflict = await this.repo.findOne({ where: { categoryName: ILike(dto.categoryName.trim()) } });
      if (nameConflict && nameConflict.categoryId !== categoryId)
        throw new ConflictException(`Category "${dto.categoryName.trim()}" already exists`);
      dto.categoryName = dto.categoryName.trim();
    }

    if (dto.categoryCode && dto.categoryCode !== category.categoryCode) {
      const conflict = await this.repo.findOne({ where: { categoryCode: dto.categoryCode } });
      if (conflict && conflict.categoryId !== categoryId)
        throw new ConflictException(`Category code "${dto.categoryCode}" is already in use`);
    }

    const { parentCategoryId, ...rest } = dto;
    Object.assign(category, rest);

    if (parentCategoryId !== undefined) {
      category.parent = parentCategoryId ? await this.resolveParent(parentCategoryId) || undefined : undefined;
    }

    return this.repo.save(category);
  }

  // ── DELETE ──────────────────────────────────────────────────────────────
  async remove(categoryId: number): Promise<void> {
    const category = await this.findOne(categoryId);
    await this.repo.remove(category);
  }

  // ── REORDER ─────────────────────────────────────────────────────────────
  async reorder(categoryId: number, newOrder: number): Promise<Category> {
    return this.update(categoryId, { displayOrder: newOrder });
  }

  // ── PRIVATE ─────────────────────────────────────────────────────────────
  private async resolveParent(parentId?: number): Promise<Category | null> {
    if (!parentId) return null;
    const parent = await this.repo.findOne({ where: { categoryId: parentId } });
    if (!parent) throw new NotFoundException(`Parent category ${parentId} not found`);
    return parent;
  }

  private async nextDisplayOrder(): Promise<number> {
    const result = await this.repo
      .createQueryBuilder("c")
      .select("MAX(c.displayOrder)", "max")
      .getRawOne<{ max: number | null }>();
    return (result?.max ?? 0) + 1;
  }
}
