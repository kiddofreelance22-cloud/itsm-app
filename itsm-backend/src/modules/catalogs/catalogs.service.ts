import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Catalog } from "./entities/catalog.entity";
import { Category } from "../categories/entities/category.entity";
import { Workflow } from "../workflows/entities/workflow.entity";
import { CreateCatalogDto } from "./dto/create-catalog.dto";
import { UpdateCatalogDto } from "./dto/update-catalog.dto";

@Injectable()
export class CatalogsService {
  constructor(
    @InjectRepository(Catalog) private catalogsRepo: Repository<Catalog>,
    @InjectRepository(Category) private categoriesRepo: Repository<Category>,
    @InjectRepository(Workflow) private workflowsRepo: Repository<Workflow>
  ) {}

  async create(dto: CreateCatalogDto): Promise<Catalog> {
    const category = await this.categoriesRepo.findOne({
      where: { categoryId: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category ${dto.categoryId} not found`);
    }

    let workflow: Workflow | null = null;
    if (dto.workflowId) {
      workflow = await this.workflowsRepo.findOne({
        where: { workflowId: dto.workflowId },
      });
      if (!workflow) {
        throw new NotFoundException(`Workflow ${dto.workflowId} not found`);
      }
    }

    const catalog = this.catalogsRepo.create({
      catalogName: dto.catalogName,
      shortDescription: dto.shortDescription,
      description: dto.description,
      category,
      iconUrl: dto.iconUrl,
      workflow,
      isActive: dto.isActive ?? true,
    });

    return this.catalogsRepo.save(catalog);
  }

  /** Catalog browsing screen: active items only, with category joined. */
  findAllActive(): Promise<Catalog[]> {
    return this.catalogsRepo.find({
      where: { isActive: true },
      relations: { category: true },
      order: { catalogName: "ASC" },
    });
  }

  findAll(): Promise<Catalog[]> {
    return this.catalogsRepo.find({
      relations: { category: true, workflow: true },
      order: { catalogId: "ASC" },
    });
  }

  async findOne(catalogId: number): Promise<Catalog> {
    const catalog = await this.catalogsRepo.findOne({
      where: { catalogId },
      relations: {
        category: true,
        workflow: true,
        variables: { options: true },
      },
      order: { variables: { sortOrder: "ASC" } },
    });
    if (!catalog) {
      throw new NotFoundException(`Catalog ${catalogId} not found`);
    }
    return catalog;
  }

  async update(catalogId: number, dto: UpdateCatalogDto): Promise<Catalog> {
    const catalog = await this.findOne(catalogId);

    if (dto.categoryId) {
      const category = await this.categoriesRepo.findOne({
        where: { categoryId: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category ${dto.categoryId} not found`);
      }
      catalog.category = category;
    }

    if (dto.workflowId !== undefined) {
      catalog.workflow = dto.workflowId
        ? await this.workflowsRepo.findOne({
            where: { workflowId: dto.workflowId },
          })
        : null;
    }

    const { categoryId, workflowId, ...rest } = dto;
    Object.assign(catalog, rest);

    return this.catalogsRepo.save(catalog);
  }

  async remove(catalogId: number): Promise<void> {
    const catalog = await this.findOne(catalogId);
    await this.catalogsRepo.remove(catalog);
  }
}
