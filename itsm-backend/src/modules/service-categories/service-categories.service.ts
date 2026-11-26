import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { ServiceCategory } from "./entities/service-category.entity";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from "./dto/service-category.dto";

/** Categories nest up to five levels; a catalog item can sit under a category at any level. */
export const MAX_CATEGORY_LEVEL = 5;

@Injectable()
export class ServiceCategoriesService {
  constructor(
    @InjectRepository(ServiceCategory) private readonly repo: Repository<ServiceCategory>,
    @InjectRepository(Catalog) private readonly catalogs: Repository<Catalog>
  ) {}

  private async resolveParentId(dto: { parentCategoryId?: number | null; parentCategoryName?: string }): Promise<number | null | undefined> {
    if (dto.parentCategoryId !== undefined) return dto.parentCategoryId;
    if (dto.parentCategoryName === undefined) return undefined;
    const name = dto.parentCategoryName.trim();
    if (!name) return null;
    const parent = await this.repo.findOne({ where: { categoryName: ILike(name) } });
    if (!parent) throw new NotFoundException(`Parent category "${name}" not found`);
    return parent.serviceCategoryId;
  }

  /** Level (1-5) of every category, from the parent chain. */
  private levels(all: ServiceCategory[]): Map<number, number> {
    const byId = new Map(all.map((c) => [c.serviceCategoryId, c]));
    const out = new Map<number, number>();
    const levelOf = (c: ServiceCategory, guard = 0): number => {
      if (out.has(c.serviceCategoryId)) return out.get(c.serviceCategoryId)!;
      const parent = c.parentCategoryId ? byId.get(c.parentCategoryId) : undefined;
      const level = !parent || guard > 10 ? 1 : levelOf(parent, guard + 1) + 1;
      out.set(c.serviceCategoryId, level);
      return level;
    };
    all.forEach((c) => levelOf(c));
    return out;
  }

  /** Deepest level inside the subtree rooted at `id` (relative: the node itself counts as 1). */
  private subtreeHeight(all: ServiceCategory[], id: number): number {
    const kids = all.filter((c) => c.parentCategoryId === id);
    return 1 + (kids.length ? Math.max(...kids.map((k) => this.subtreeHeight(all, k.serviceCategoryId))) : 0);
  }

  private async assertPlacement(id: number | null, parentId: number | null | undefined): Promise<void> {
    if (!parentId) return;
    const all = await this.repo.find();
    const levels = this.levels(all);
    const parent = all.find((c) => c.serviceCategoryId === parentId);
    if (!parent) throw new NotFoundException(`Parent category ${parentId} not found`);
    if (id !== null) {
      if (parentId === id) throw new BadRequestException("A category cannot be its own parent");
      let cursor: ServiceCategory | undefined = parent;
      for (let i = 0; cursor && i < 12; i++) {
        if (cursor.serviceCategoryId === id) throw new BadRequestException("A category cannot be moved under one of its own sub-categories");
        cursor = cursor.parentCategoryId ? all.find((c) => c.serviceCategoryId === cursor!.parentCategoryId) : undefined;
      }
    }
    const height = id === null ? 1 : this.subtreeHeight(all, id);
    if ((levels.get(parentId) ?? 1) + height > MAX_CATEGORY_LEVEL) {
      throw new BadRequestException(`Categories can be nested up to ${MAX_CATEGORY_LEVEL} levels deep`);
    }
  }

  async create(dto: CreateServiceCategoryDto) {
    const categoryName = dto.categoryName.trim();
    if (await this.repo.findOne({ where: { categoryName: ILike(categoryName) } })) {
      throw new ConflictException(`Service category "${categoryName}" already exists`);
    }
    const { parentCategoryName, parentCategoryId: _ignored, ...data } = dto;
    const parentId = await this.resolveParentId(dto);
    await this.assertPlacement(null, parentId);
    return this.repo.save(this.repo.create({ ...data, parentCategoryId: parentId ?? undefined, categoryName }));
  }

  /** Flat list with each category's level and how many sub-categories / catalog items sit directly under it. */
  async findAll() {
    const items = await this.repo.find({ relations: { parentCategory: true }, order: { sortOrder: "ASC", categoryName: "ASC" } });
    const levels = this.levels(items);
    const counts = await this.catalogs.createQueryBuilder("c")
      .leftJoin("c.serviceCategory", "sc").select("sc.serviceCategoryId", "id").addSelect("COUNT(c.catalogId)", "n")
      .where("sc.serviceCategoryId IS NOT NULL").groupBy("sc.serviceCategoryId").getRawMany<{ id: number; n: string }>();
    const itemCount = new Map(counts.map((r) => [Number(r.id), Number(r.n)]));
    return items.map((item) => ({
      ...item,
      parentCategoryName: item.parentCategory?.categoryName,
      level: levels.get(item.serviceCategoryId) ?? 1,
      childCount: items.filter((c) => c.parentCategoryId === item.serviceCategoryId).length,
      itemCount: itemCount.get(item.serviceCategoryId) ?? 0,
    }));
  }

  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { serviceCategoryId: id } });
    if (!item) throw new NotFoundException(`Service category ${id} not found`);
    return item;
  }

  async update(id: number, dto: UpdateServiceCategoryDto) {
    const item = await this.findOne(id);
    if (dto.categoryName) {
      const categoryName = dto.categoryName.trim();
      const conflict = await this.repo.findOne({ where: { categoryName: ILike(categoryName) } });
      if (conflict && conflict.serviceCategoryId !== id) throw new ConflictException(`Service category "${categoryName}" already exists`);
      dto.categoryName = categoryName;
    }
    const { parentCategoryName, parentCategoryId: _ignored, ...data } = dto;
    const parentId = await this.resolveParentId(dto);
    if (parentId !== undefined && parentId !== (item.parentCategoryId ?? null)) {
      await this.assertPlacement(id, parentId);
      item.parentCategoryId = parentId ?? undefined;
    }
    Object.assign(item, data);
    return this.repo.save(item);
  }

  async remove(id: number) {
    const item = await this.findOne(id);
    const [children, items] = await Promise.all([
      this.repo.count({ where: { parentCategoryId: id } }),
      this.catalogs.createQueryBuilder("c").leftJoin("c.serviceCategory", "sc").where("sc.serviceCategoryId = :id", { id }).getCount(),
    ]);
    if (children || items) {
      throw new BadRequestException(`"${item.categoryName}" still has ${children} sub-categor${children === 1 ? "y" : "ies"} and ${items} catalog item${items === 1 ? "" : "s"}. Move or remove them first.`);
    }
    await this.repo.remove(item);
  }
}
