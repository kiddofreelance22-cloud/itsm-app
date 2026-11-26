import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Catalog } from "./entities/catalog.entity";
import { CatalogVariable } from "./entities/catalog-variable.entity";
import { CatalogVariableOption } from "./entities/catalog-variable-option.entity";
import { CatalogFormSection } from "./entities/catalog-form-section.entity";
import { CatalogAttachment } from "./entities/catalog-attachment.entity";
import { Category } from "../categories/entities/category.entity";
import { SubCategory } from "../sub-category/entities/sub-category.entity";
import { Workflow } from "../workflows/entities/workflow.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { ServicePriority } from "../service-priorities/entities/service-priority.entity";
import { Impact } from "../impact/entities/impact.entity";
import { Urgency } from "../urgency/entities/urgency.entity";
import { ServiceUrgency } from "../service-urgencies/entities/service-urgency.entity";
import { ServiceImpact } from "../service-impacts/entities/service-impact.entity";
import { ServiceCategory } from "../service-categories/entities/service-category.entity";
import { UploadsModule } from "../uploads/uploads.module";
import { CatalogsService } from "./catalogs.service";
import { CatalogsController } from "./catalogs.controller";
import { CatalogVariablesService } from "./variables/catalog-variables.service";
import { CatalogVariablesController } from "./variables/catalog-variables.controller";
import { CatalogSectionsService } from "./sections/catalog-sections.service";
import { CatalogSectionsController } from "./sections/catalog-sections.controller";
import { CatalogAttachmentsService } from "./attachments/catalog-attachments.service";
import { CatalogAttachmentsController } from "./attachments/catalog-attachments.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Catalog, CatalogVariable, CatalogVariableOption,
      CatalogFormSection, CatalogAttachment,
      Category, SubCategory, Workflow, AssignmentGroup,
      ServicePriority, Impact, Urgency, ServiceUrgency, ServiceImpact, ServiceCategory,
    ]),
    UploadsModule,
  ],
  controllers: [
    CatalogsController,
    CatalogVariablesController,
    CatalogSectionsController,
    CatalogAttachmentsController,
  ],
  providers: [
    CatalogsService,
    CatalogVariablesService,
    CatalogSectionsService,
    CatalogAttachmentsService,
  ],
  exports: [CatalogsService],
})
export class CatalogsModule {}
