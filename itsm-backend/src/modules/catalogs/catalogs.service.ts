import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Catalog } from "./entities/catalog.entity";
import { Category } from "../categories/entities/category.entity";
import { SubCategory } from "../sub-category/entities/sub-category.entity";
import { Workflow } from "../workflows/entities/workflow.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { Priority } from "../priority/entities/priority.entity";
import { Impact } from "../impact/entities/impact.entity";
import { Urgency } from "../urgency/entities/urgency.entity";
import { ServiceCategory } from "../service-categories/entities/service-category.entity";
import { CreateCatalogDto } from "./dto/create-catalog.dto";
import { UpdateCatalogDto } from "./dto/update-catalog.dto";

const RELATIONS = {
  category: { parent: true },
  serviceCategory: true,
  subCategory: true,
  workflow: true, fulfillmentWorkflow: true,
  fulfillmentGroup: true, assignmentGroup: true,
  priority: true, impact: true, urgency: true,
  variables: { options: true, section: true },
  sections: true,
};

@Injectable()
export class CatalogsService {
  constructor(
    @InjectRepository(Catalog)         private catalogsRepo:  Repository<Catalog>,
    @InjectRepository(Category)        private categoriesRepo: Repository<Category>,
    @InjectRepository(SubCategory)     private subCategoriesRepo: Repository<SubCategory>,
    @InjectRepository(Workflow)        private workflowsRepo: Repository<Workflow>,
    @InjectRepository(AssignmentGroup) private groupsRepo:    Repository<AssignmentGroup>,
    @InjectRepository(Priority)        private prioritiesRepo: Repository<Priority>,
    @InjectRepository(Impact)          private impactsRepo:   Repository<Impact>,
    @InjectRepository(Urgency)         private urgenciesRepo:  Repository<Urgency>,
    @InjectRepository(ServiceCategory)  private serviceCategoriesRepo: Repository<ServiceCategory>,
  ) {}

  async create(dto: CreateCatalogDto): Promise<Catalog> {
    const {
      categoryId, serviceCategoryId, subCategoryId,
      workflowId, fulfillmentWorkflowId, fulfillmentGroupId, assignmentGroupId,
      priorityId, impactId, urgencyId,
      ...rest
    } = dto;

    const catalog = this.catalogsRepo.create({
      ...rest,
      isActive: dto.isActive ?? true,
    });

    if (categoryId) {
      catalog.category = await this.categoriesRepo.findOne({ where: { categoryId } }) || undefined;
    }
    if (serviceCategoryId) {
      catalog.serviceCategory = await this.serviceCategoriesRepo.findOne({ where: { serviceCategoryId } }) || undefined;
    }
    if (subCategoryId) {
      catalog.subCategory = await this.subCategoriesRepo.findOne({ where: { subCategoryId } }) || undefined;
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
    if (priorityId) {
      catalog.priority = await this.prioritiesRepo.findOne({ where: { priorityId } }) || undefined;
    }
    if (impactId) {
      catalog.impact = await this.impactsRepo.findOne({ where: { impactId } }) || undefined;
    }
    if (urgencyId) {
      catalog.urgency = await this.urgenciesRepo.findOne({ where: { urgencyId } }) || undefined;
    }

    return this.catalogsRepo.save(catalog);
  }

  findAllActive(): Promise<Catalog[]> {
    return this.catalogsRepo.find({
      where: { isActive: true },
      relations: { category: true, serviceCategory: true, workflow: true },
      order: { catalogName: "ASC" },
    });
  }

  findAll(): Promise<Catalog[]> {
    return this.catalogsRepo.find({
      relations: {
        category: { parent: true }, serviceCategory: true,
        workflow: true, fulfillmentGroup: true, assignmentGroup: true,
      },
      order: { catalogId: "ASC" },
    });
  }

  async findOne(catalogId: number): Promise<Catalog> {
    const catalog = await this.catalogsRepo.findOne({
      where: { catalogId },
      relations: RELATIONS,
      order: { variables: { sortOrder: "ASC" }, sections: { displayOrder: "ASC" } },
    });
    if (!catalog) throw new NotFoundException(`Catalog ${catalogId} not found`);
    return catalog;
  }

  async update(catalogId: number, dto: UpdateCatalogDto): Promise<Catalog> {
    const catalog = await this.findOne(catalogId);
    const {
      categoryId, serviceCategoryId, subCategoryId,
      workflowId, fulfillmentWorkflowId, fulfillmentGroupId, assignmentGroupId,
      priorityId, impactId, urgencyId,
      ...rest
    } = dto;

    Object.assign(catalog, rest);

    if (categoryId !== undefined) {
      catalog.category = categoryId
        ? await this.categoriesRepo.findOne({ where: { categoryId } }) || undefined
        : undefined;
    }
    if (serviceCategoryId !== undefined) {
      catalog.serviceCategory = serviceCategoryId
        ? await this.serviceCategoriesRepo.findOne({ where: { serviceCategoryId } }) || undefined
        : undefined;
    }
    if (subCategoryId !== undefined) {
      catalog.subCategory = subCategoryId
        ? await this.subCategoriesRepo.findOne({ where: { subCategoryId } }) || undefined
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
    if (priorityId !== undefined) {
      catalog.priority = priorityId
        ? await this.prioritiesRepo.findOne({ where: { priorityId } }) || undefined
        : undefined;
    }
    if (impactId !== undefined) {
      catalog.impact = impactId
        ? await this.impactsRepo.findOne({ where: { impactId } }) || undefined
        : undefined;
    }
    if (urgencyId !== undefined) {
      catalog.urgency = urgencyId
        ? await this.urgenciesRepo.findOne({ where: { urgencyId } }) || undefined
        : undefined;
    }

    return this.catalogsRepo.save(catalog);
  }

  async remove(catalogId: number): Promise<void> {
    const catalog = await this.findOne(catalogId);
    await this.catalogsRepo.remove(catalog);
  }
}
