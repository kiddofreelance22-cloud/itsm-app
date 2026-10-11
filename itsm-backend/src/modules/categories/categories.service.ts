import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, ILike, Repository } from "typeorm";
import { Category } from "./entities/category.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

export type CategoryDeletePolicy = "cascade" | "reparent";
const MAX_CATEGORY_LEVEL = 5;

/** Nested tree node shape returned by findTree()/atomic mutations. */
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  /** Scope actually in effect for this node once inheritance is resolved. */
  effectiveScope: {
    workgroupIds: number[] | null;
    locationIds: number[] | null;
    memberIds: number[] | null;
    inherited: boolean;
  };
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private repo: Repository<Category>,
    @InjectRepository(AssignmentGroup) private groupRepo: Repository<AssignmentGroup>,
    private dataSource: DataSource,
  ) {}

  // ── CREATE ──────────────────────────────────────────────────────────────
  async create(dto: CreateCategoryDto): Promise<CategoryTreeNode> {
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

    this.validateScopeArrays(dto);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Category);

      const parent = dto.parentCategoryId ? await this.resolveParent(repo, dto.parentCategoryId) : null;
      const parentLevel = parent?.materializedPath?.split("/").filter(Boolean).length ?? 0;
      if (parentLevel >= MAX_CATEGORY_LEVEL) {
        throw new BadRequestException(`Categories can be nested only ${MAX_CATEGORY_LEVEL} levels deep`);
      }

      const category = repo.create({
        categoryName,
        categoryCode: code,
        description: dto.description ?? undefined,
        displayOrder,
        icon: dto.icon ?? undefined,
        isActive: dto.isActive ?? true,
        availableInPortal: dto.availableInPortal ?? true,
        availableInMobile: dto.availableInMobile ?? true,
        showInCatalog: dto.showInCatalog ?? true,
        allowInIncident: dto.allowInIncident ?? true,
        workgroupIds: dto.workgroupIds ?? null,
        locationIds: dto.locationIds ?? null,
        memberIds: dto.memberIds ?? null,
        parentCategoryId: parent?.categoryId ?? null,
      });

      if (dto.defaultAssignmentGroupId) {
        category.defaultAssignmentGroup = await this.resolveAssignmentGroup(manager.getRepository(AssignmentGroup), dto.defaultAssignmentGroupId);
      }

      const saved = await repo.save(category);
      // Path can only be computed once the auto-generated categoryId exists.
      saved.materializedPath = `${parent?.materializedPath ?? "/"}${saved.categoryId}/`;
      await repo.save(saved);

      return this.hydrateNode(saved);
    });
  }

  // ── READ ────────────────────────────────────────────────────────────────
  findAll(): Promise<Category[]> {
    return this.repo.find({
      relations: { parent: true, children: true, defaultAssignmentGroup: true },
      order: { displayOrder: "ASC", categoryId: "ASC" },
    });
  }

  /**
   * Returns the full category tree as real, deeply-nested JSON — every
   * node's `children` array recursively contains its own children, however
   * deep the hierarchy goes (unlike a plain TypeORM `relations` load, which
   * only hydrates one level). This is what the admin tree view and the
   * incident category picker both consume.
   */
  async findTree(): Promise<CategoryTreeNode[]> {
    const flat = await this.repo.find({
      relations: { defaultAssignmentGroup: true },
      order: { displayOrder: "ASC", categoryId: "ASC" },
    });
    return this.buildTree(flat);
  }

  async findOne(categoryId: number): Promise<Category> {
    const cat = await this.repo.findOne({
      where: { categoryId },
      relations: { parent: true, children: true, defaultAssignmentGroup: true },
    });
    if (!cat) throw new NotFoundException(`Category ${categoryId} not found`);
    return cat;
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────
  async update(categoryId: number, dto: UpdateCategoryDto): Promise<CategoryTreeNode> {
    this.validateScopeArrays(dto);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Category);

      const category = await repo.findOne({ where: { categoryId }, relations: { parent: true } });
      if (!category) throw new NotFoundException(`Category ${categoryId} not found`);

      if (dto.parentCategoryId === categoryId)
        throw new BadRequestException("A category cannot be its own parent");

      if (dto.categoryName && dto.categoryName.trim().toLowerCase() !== category.categoryName.toLowerCase()) {
        const nameConflict = await repo.findOne({ where: { categoryName: ILike(dto.categoryName.trim()) } });
        if (nameConflict && nameConflict.categoryId !== categoryId)
          throw new ConflictException(`Category "${dto.categoryName.trim()}" already exists`);
        dto.categoryName = dto.categoryName.trim();
      }

      if (dto.categoryCode && dto.categoryCode !== category.categoryCode) {
        const conflict = await repo.findOne({ where: { categoryCode: dto.categoryCode } });
        if (conflict && conflict.categoryId !== categoryId)
          throw new ConflictException(`Category code "${dto.categoryCode}" is already in use`);
      }

      const { parentCategoryId, workgroupIds, locationIds, memberIds, defaultAssignmentGroupId, ...rest } = dto;
      Object.assign(category, rest);
      if (parentCategoryId !== undefined) category.parentCategoryId = parentCategoryId ?? null;
      if (workgroupIds !== undefined) category.workgroupIds = workgroupIds.length ? workgroupIds : null;
      if (locationIds !== undefined) category.locationIds = locationIds.length ? locationIds : null;
      if (memberIds !== undefined) category.memberIds = memberIds.length ? memberIds : null;
      if (defaultAssignmentGroupId !== undefined) {
        category.defaultAssignmentGroup = defaultAssignmentGroupId
          ? await this.resolveAssignmentGroup(manager.getRepository(AssignmentGroup), defaultAssignmentGroupId)
          : undefined;
      }

      const isMovingParent = parentCategoryId !== undefined
        && (parentCategoryId ?? null) !== (category.parent?.categoryId ?? null);

      if (!isMovingParent) {
        await repo.save(category);
        const expectedPath = `${category.parent?.materializedPath ?? "/"}${category.categoryId}/`;
        if (category.materializedPath !== expectedPath) {
          await this.reparentSubtree(repo, category, category.parent ?? null);
        }
        return this.hydrateNode(category);
      }

      // ── Parent relocation: this mutates category_id relational keys at
      // the tree-structure level (the node's position in the hierarchy),
      // so every descendant's materialized_path must be re-derived in the
      // same transaction as an atomic operation — never left half-applied.
      const newParent = parentCategoryId ? await this.resolveParent(repo, parentCategoryId) : null;
      if (newParent) {
        const wouldCycle = newParent.materializedPath?.split("/").filter(Boolean)
          .map(Number).includes(categoryId);
        if (wouldCycle || newParent.categoryId === categoryId)
          throw new BadRequestException("Cannot move a category under its own descendant");
      }
      const oldPath = category.materializedPath ?? `/${categoryId}/`;
      const currentLevel = oldPath.split("/").filter(Boolean).length;
      const subtree = await repo
        .createQueryBuilder("c")
        .select(["c.categoryId", "c.materializedPath"])
        .where("c.materialized_path LIKE :prefix", { prefix: `${oldPath}%` })
        .getMany();
      const subtreeDepth = subtree.reduce(
        (maxDepth, node) => Math.max(maxDepth, (node.materializedPath?.split("/").filter(Boolean).length ?? currentLevel) - currentLevel),
        0,
      );
      const newParentLevel = newParent?.materializedPath?.split("/").filter(Boolean).length ?? 0;
      if (newParentLevel + 1 + subtreeDepth > MAX_CATEGORY_LEVEL) {
        throw new BadRequestException(`Categories can be nested only ${MAX_CATEGORY_LEVEL} levels deep`);
      }

      category.parent = newParent;
      category.parentCategoryId = newParent?.categoryId ?? null;
      await repo.save(category);
      await this.reparentSubtree(repo, category, newParent);

      const rehydrated = await repo.findOneOrFail({ where: { categoryId } });
      return this.hydrateNode(rehydrated);
    });
  }

  /**
   * Recomputes materialized_path for `node` and rehydrates every descendant
   * path underneath it, in one transactional pass, after a parent change.
   */
  private async reparentSubtree(repo: Repository<Category>, node: Category, newParent: Category | null) {
    const oldPath = node.materializedPath;
    const newPath = `${newParent?.materializedPath ?? "/"}${node.categoryId}/`;
    node.parent = newParent;
    node.parentCategoryId = newParent?.categoryId ?? null;
    node.materializedPath = newPath;
    await repo.save(node);

    if (!oldPath) return;
    const descendants = await repo
      .createQueryBuilder("c")
      .where("c.materialized_path LIKE :prefix", { prefix: `${oldPath}%` })
      .andWhere("c.category_id != :id", { id: node.categoryId })
      .getMany();

    for (const d of descendants) {
      d.materializedPath = newPath + d.materializedPath.slice(oldPath.length);
    }
    if (descendants.length) await repo.save(descendants);
  }

  // ── DELETE ──────────────────────────────────────────────────────────────
  /**
   * Node pruning. `policy` decides what happens to the node's children:
   *  - "cascade":  delete the node and every nested subcategory/config under it.
   *  - "reparent": delete only this node and shift its direct children up one
   *                level, onto its own parent (or to root if it had none).
   * Runs as a single transaction so the tree is never left in a partial state.
   */
  async remove(categoryId: number, policy: CategoryDeletePolicy = "reparent"): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Category);
      const category = await repo.findOne({ where: { categoryId }, relations: { parent: true } });
      if (!category) throw new NotFoundException(`Category ${categoryId} not found`);

      if (policy === "cascade") {
        const path = category.materializedPath ?? `/${categoryId}/`;
        const subtree = await repo
          .createQueryBuilder("c")
          .where("c.materialized_path LIKE :prefix", { prefix: `${path}%` })
          .getMany();
        // Delete leaf-first (longest paths first) to respect the self-FK.
        subtree.sort((a, b) => (b.materializedPath?.length ?? 0) - (a.materializedPath?.length ?? 0));
        for (const node of subtree) await repo.remove(node);
        return;
      }

      // reparent / "shift up": children move to this node's own parent.
      const children = await repo.find({ where: { parent: { categoryId } } });
      for (const child of children) {
        child.parent = category.parent ?? undefined;
        child.parentCategoryId = category.parentCategoryId ?? null;
        await repo.save(child);
        await this.reparentSubtree(repo, child, category.parent ?? null);
      }
      await repo.remove(category);
    });
  }

  // ── REORDER ─────────────────────────────────────────────────────────────
  async reorder(categoryId: number, newOrder: number): Promise<CategoryTreeNode> {
    return this.update(categoryId, { displayOrder: newOrder });
  }

  // ── PRIVATE ─────────────────────────────────────────────────────────────
  private async resolveParent(repo: Repository<Category>, parentId?: number): Promise<Category | null> {
    if (!parentId) return null;
    const parent = await repo.findOne({ where: { categoryId: parentId } });
    if (!parent) throw new NotFoundException(`Parent category ${parentId} not found`);
    return parent;
  }

  private async resolveAssignmentGroup(repo: Repository<AssignmentGroup>, groupId: number): Promise<AssignmentGroup> {
    const group = await repo.findOne({ where: { groupId } });
    if (!group) throw new NotFoundException(`Assignment group ${groupId} not found`);
    return group;
  }

  /**
   * Walks up from `categoryId` through its ancestors (via materializedPath)
   * until it finds one with defaultAssignmentGroup set, and returns that
   * group's id — or null if neither the category nor any ancestor has one.
   * This is what IncidentsService uses to route a new incident's assignment
   * group by category instead of always falling back to the single global
   * default group.
   */
  /**
   * Routing for a category. Each setting is inherited independently from the nearest ancestor that sets it,
   * so a child can override just the workgroup while still inheriting the location and preferred member.
   */
  async getEffectiveRouting(categoryId: number): Promise<{ groupId: number | null; workgroupId: number | null; locationId: number | null; memberId: number | null }> {
    const node = await this.repo.findOne({ where: { categoryId }, relations: { defaultAssignmentGroup: true } });
    const out = { groupId: null as number | null, workgroupId: null as number | null, locationId: null as number | null, memberId: null as number | null };
    if (!node) return out;
    const ids = (node.materializedPath ?? "").split("/").filter(Boolean).map(Number).filter((id) => id !== categoryId);
    const ancestors = ids.length ? await this.repo.find({ where: ids.map((id) => ({ categoryId: id })), relations: { defaultAssignmentGroup: true } }) : [];
    const byId = new Map<number, Category>(ancestors.map((a) => [a.categoryId, a]));
    const chain: Category[] = [node, ...ids.slice().reverse().map((id) => byId.get(id)).filter((c): c is Category => !!c)];   // nearest first
    for (const c of chain) {
      out.groupId ??= c.defaultAssignmentGroup?.groupId ?? null;
      out.workgroupId ??= c.workgroupIds?.[0] ?? null;
      out.locationId ??= c.locationIds?.[0] ?? null;
      out.memberId ??= c.memberIds?.[0] ?? null;
    }
    return out;
  }

  async getEffectiveAssignmentGroupId(categoryId: number): Promise<number | null> {
    const category = await this.repo.findOne({
      where: { categoryId },
      relations: { defaultAssignmentGroup: true },
    });
    if (!category) return null;
    if (category.defaultAssignmentGroup) return category.defaultAssignmentGroup.groupId;
    if (!category.materializedPath) return null;

    const ancestorIds = category.materializedPath.split("/").filter(Boolean).map(Number)
      .filter((id) => id !== categoryId);
    if (ancestorIds.length === 0) return null;

    const ancestors: Category[] = await this.repo.find({
      where: ancestorIds.map((id) => ({ categoryId: id })),
      relations: { defaultAssignmentGroup: true },
    });
    const byId = new Map<number, Category>(ancestors.map((a) => [a.categoryId, a]));

    // materializedPath is root→leaf, so walk it nearest-ancestor-first.
    for (let i = ancestorIds.length - 1; i >= 0; i--) {
      const ancestor = byId.get(ancestorIds[i]);
      if (ancestor?.defaultAssignmentGroup) return ancestor.defaultAssignmentGroup.groupId;
    }
    return null;
  }

  private async nextDisplayOrder(): Promise<number> {
    const result = await this.repo
      .createQueryBuilder("c")
      .select("MAX(c.displayOrder)", "max")
      .getRawOne<{ max: number | null }>();
    return (result?.max ?? 0) + 1;
  }

  private validateScopeArrays(dto: Pick<CreateCategoryDto, "workgroupIds" | "locationIds" | "memberIds">) {
    for (const [key, arr] of Object.entries({
      workgroupIds: dto.workgroupIds, locationIds: dto.locationIds, memberIds: dto.memberIds,
    })) {
      if (arr && arr.some((n) => !Number.isInteger(n) || n <= 0)) {
        throw new BadRequestException(`${key} must contain valid positive ids`);
      }
    }
  }

  private buildTree(flat: Category[]): CategoryTreeNode[] {
    const byParent = new Map<number | "root", Category[]>();
    for (const c of flat) {
      const key = c.parentCategoryId ?? "root";
      const list = byParent.get(key) ?? [];
      list.push(c);
      byParent.set(key, list);
    }

    const attach = (nodes: Category[], ancestorScope: CategoryTreeNode["effectiveScope"]): CategoryTreeNode[] =>
      nodes.map((n) => {
        const hasOwnScope = !!(n.workgroupIds?.length || n.locationIds?.length || n.memberIds?.length);
        const effectiveScope = hasOwnScope
          ? { workgroupIds: n.workgroupIds, locationIds: n.locationIds, memberIds: n.memberIds, inherited: false }
          : ancestorScope;
        const children = attach(byParent.get(n.categoryId) ?? [], effectiveScope);
        return {
          ...n,
          parentCategoryId: n.parentCategoryId ?? null,
          children,
          effectiveScope,
        } as CategoryTreeNode;
      });

    const noScope = { workgroupIds: null, locationIds: null, memberIds: null, inherited: false };
    return attach(byParent.get("root") ?? [], noScope);
  }

  private hydrateNode(category: Category): CategoryTreeNode {
    const hasOwnScope = !!(category.workgroupIds?.length || category.locationIds?.length || category.memberIds?.length);
    return {
      ...category,
      children: [],
      effectiveScope: {
        workgroupIds: category.workgroupIds ?? null,
        locationIds: category.locationIds ?? null,
        memberIds: category.memberIds ?? null,
        inherited: !hasOwnScope,
      },
    } as unknown as CategoryTreeNode;
  }
}
