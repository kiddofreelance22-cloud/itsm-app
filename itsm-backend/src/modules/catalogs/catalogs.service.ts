import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Catalog } from "./entities/catalog.entity";
import { Category } from "../categories/entities/category.entity";
import { SubCategory } from "../sub-category/entities/sub-category.entity";
import { Workflow } from "../workflows/entities/workflow.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { ServicePriority } from "../service-priorities/entities/service-priority.entity";
import { Impact } from "../impact/entities/impact.entity";
import { ServiceUrgency } from "../service-urgencies/entities/service-urgency.entity";
import { ServiceImpact } from "../service-impacts/entities/service-impact.entity";
import { ServiceCategory } from "../service-categories/entities/service-category.entity";
import { CreateCatalogDto } from "./dto/create-catalog.dto";
import { UpdateCatalogDto } from "./dto/update-catalog.dto";

const RELATIONS = {
  category: { parent: true },
  serviceCategory: true,
  subCategory: true,
  workflow: true, fulfillmentWorkflow: true,
  fulfillmentGroup: true, assignmentGroup: true,
  priority: true, impact: true, urgency: true, serviceImpact: true,
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
    @InjectRepository(ServicePriority) private prioritiesRepo: Repository<ServicePriority>,
    @InjectRepository(Impact)          private impactsRepo:   Repository<Impact>,
    @InjectRepository(ServiceUrgency)  private urgenciesRepo:  Repository<ServiceUrgency>,
    @InjectRepository(ServiceImpact)   private serviceImpactsRepo: Repository<ServiceImpact>,
    @InjectRepository(ServiceCategory)  private serviceCategoriesRepo: Repository<ServiceCategory>,
  ) {}

  private async serviceRequestWorkflow(workflowId: number) {
    const workflow = await this.workflowsRepo.findOne({ where: { workflowId } });
    if (!workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);
    if (workflow.workflowScope !== "service_request") {
      throw new BadRequestException("Service catalog items can only use Service Request lifecycles.");
    }
    return workflow;
  }

  async create(dto: CreateCatalogDto): Promise<Catalog> {
    const {
      categoryId, serviceCategoryId, subCategoryId,
      workflowId, fulfillmentWorkflowId, fulfillmentGroupId, assignmentGroupId,
      priorityId, impactId, urgencyId, serviceImpactId,
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
      catalog.workflow = await this.serviceRequestWorkflow(workflowId);
    }
    if (fulfillmentWorkflowId) {
      catalog.fulfillmentWorkflow = await this.serviceRequestWorkflow(fulfillmentWorkflowId);
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
    if (serviceImpactId) {
      catalog.serviceImpact = await this.serviceImpactsRepo.findOne({ where: { serviceImpactId } }) || undefined;
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
      priorityId, impactId, urgencyId, serviceImpactId,
      ...rest
    } = dto;

    Object.assign(catalog, rest);
    // One catalog, one status: switching an item Active on the catalog screen publishes it for the builder and the end-user view too.
    if (catalog.isActive && String(catalog.status).toLowerCase() === "draft" && (rest as any).status === undefined) catalog.status = "published";

    if (categoryId !== undefined) {
      catalog.category = categoryId
        ? await this.categoriesRepo.findOne({ where: { categoryId } }) || undefined
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }
    if (serviceCategoryId !== undefined) {
      catalog.serviceCategory = serviceCategoryId
        ? await this.serviceCategoriesRepo.findOne({ where: { serviceCategoryId } }) || undefined
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }
    if (subCategoryId !== undefined) {
      catalog.subCategory = subCategoryId
        ? await this.subCategoriesRepo.findOne({ where: { subCategoryId } }) || undefined
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }
    if (workflowId !== undefined) {
      catalog.workflow = workflowId
        ? await this.serviceRequestWorkflow(workflowId)
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }
    if (fulfillmentWorkflowId !== undefined) {
      catalog.fulfillmentWorkflow = fulfillmentWorkflowId
        ? await this.serviceRequestWorkflow(fulfillmentWorkflowId)
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }
    if (fulfillmentGroupId !== undefined) {
      catalog.fulfillmentGroup = fulfillmentGroupId
        ? await this.groupsRepo.findOne({ where: { groupId: fulfillmentGroupId } }) || undefined
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }
    if (assignmentGroupId !== undefined) {
      catalog.assignmentGroup = assignmentGroupId
        ? await this.groupsRepo.findOne({ where: { groupId: assignmentGroupId } }) || undefined
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }
    if (priorityId !== undefined) {
      catalog.priority = priorityId
        ? await this.prioritiesRepo.findOne({ where: { priorityId } }) || undefined
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }
    if (impactId !== undefined) {
      catalog.impact = impactId
        ? await this.impactsRepo.findOne({ where: { impactId } }) || undefined
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }
    if (urgencyId !== undefined) {
      catalog.urgency = urgencyId
        ? await this.urgenciesRepo.findOne({ where: { urgencyId } }) || undefined
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }
    if (serviceImpactId !== undefined) {
      catalog.serviceImpact = serviceImpactId
        ? await this.serviceImpactsRepo.findOne({ where: { serviceImpactId } }) || undefined
        : (null as unknown as undefined); // null clears the column; undefined would be skipped by TypeORM
    }

    return this.catalogsRepo.save(catalog);
  }

  async remove(catalogId: number): Promise<void> {
    const catalog = await this.findOne(catalogId);
    await this.catalogsRepo.remove(catalog);
  }
}
