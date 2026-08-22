import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Catalog } from "./entities/catalog.entity";
import { Category } from "../categories/entities/category.entity";
import { Workflow } from "../workflows/entities/workflow.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { CreateCatalogDto } from "./dto/create-catalog.dto";
import { UpdateCatalogDto } from "./dto/update-catalog.dto";

const RELATIONS = {
  category: true, workflow: true, fulfillmentWorkflow: true,
  fulfillmentGroup: true, assignmentGroup: true,
  variables: { options: true },
};

@Injectable()
export class CatalogsService {
  constructor(
    @InjectRepository(Catalog)         private catalogsRepo:  Repository<Catalog>,
    @InjectRepository(Category)        private categoriesRepo: Repository<Category>,
    @InjectRepository(Workflow)        private workflowsRepo: Repository<Workflow>,
    @InjectRepository(AssignmentGroup) private groupsRepo:    Repository<AssignmentGroup>,
  ) {}

  async create(dto: CreateCatalogDto): Promise<Catalog> {
    const { categoryId, workflowId, fulfillmentWorkflowId, fulfillmentGroupId, assignmentGroupId, ...rest } = dto;

    const catalog = this.catalogsRepo.create({
      ...rest,
      isActive: dto.isActive ?? true,
    });

    if (categoryId) {
      catalog.category = await this.categoriesRepo.findOne({ where: { categoryId } }) || undefined;
    }
    if (workflowId) {
      catalog.workflow = await this.workflowsRepo.findOne({ where: { workflowId } }) || undefined;
    }
    if (fulfillmentWorkflowId) {
      catalog.fulfillmentWorkflow = await this.workflowsRepo.findOne({ where: { workflowId: fulfillmentWorkflowId } }) || undefined;
    }
    if (fulfillmentGroupId) {
      catalog.fulfillmentGroup = await this.groupsRepo.findOne({ where: { groupId: fulfillmentGroupId } }) || undefined;
    }
    if (assignmentGroupId) {
      catalog.assignmentGroup = await this.groupsRepo.findOne({ where: { groupId: assignmentGroupId } }) || undefined;
    }

    return this.catalogsRepo.save(catalog);
  }

  findAllActive(): Promise<Catalog[]> {
    return this.catalogsRepo.find({
      where: { isActive: true },
      relations: { category: true, workflow: true },
      order: { catalogName: "ASC" },
    });
  }

  findAll(): Promise<Catalog[]> {
    return this.catalogsRepo.find({
      relations: { category: true, workflow: true, fulfillmentGroup: true, assignmentGroup: true },
      order: { catalogId: "ASC" },
    });
  }

  async findOne(catalogId: number): Promise<Catalog> {
    const catalog = await this.catalogsRepo.findOne({
      where: { catalogId },
      relations: RELATIONS,
      order: { variables: { sortOrder: "ASC" } },
    });
    if (!catalog) throw new NotFoundException(`Catalog ${catalogId} not found`);
    return catalog;
  }

  async update(catalogId: number, dto: UpdateCatalogDto): Promise<Catalog> {
    const catalog = await this.findOne(catalogId);
    const { categoryId, workflowId, fulfillmentWorkflowId, fulfillmentGroupId, assignmentGroupId, ...rest } = dto;

    Object.assign(catalog, rest);

    if (categoryId !== undefined) {
      catalog.category = categoryId
        ? await this.categoriesRepo.findOne({ where: { categoryId } }) || undefined
        : undefined;
    }
    if (workflowId !== undefined) {
      catalog.workflow = workflowId
        ? await this.workflowsRepo.findOne({ where: { workflowId } }) || undefined
        : undefined;
    }
    if (fulfillmentWorkflowId !== undefined) {
      catalog.fulfillmentWorkflow = fulfillmentWorkflowId
        ? await this.workflowsRepo.findOne({ where: { workflowId: fulfillmentWorkflowId } }) || undefined
        : undefined;
    }
    if (fulfillmentGroupId !== undefined) {
      catalog.fulfillmentGroup = fulfillmentGroupId
        ? await this.groupsRepo.findOne({ where: { groupId: fulfillmentGroupId } }) || undefined
        : undefined;
    }
    if (assignmentGroupId !== undefined) {
      catalog.assignmentGroup = assignmentGroupId
        ? await this.groupsRepo.findOne({ where: { groupId: assignmentGroupId } }) || undefined
        : undefined;
    }

    return this.catalogsRepo.save(catalog);
  }

  async remove(catalogId: number): Promise<void> {
    const catalog = await this.findOne(catalogId);
    await this.catalogsRepo.remove(catalog);
  }
}
