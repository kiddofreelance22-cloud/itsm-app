import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Catalog } from "./entities/catalog.entity";
import { CatalogVariable } from "./entities/catalog-variable.entity";
import { CatalogVariableOption } from "./entities/catalog-variable-option.entity";
import { Workflow } from "../workflows/entities/workflow.entity";
import { CatalogsService } from "./catalogs.service";
import { CatalogsController } from "./catalogs.controller";
import { CatalogVariablesService } from "./variables/catalog-variables.service";
import { CatalogVariablesController } from "./variables/catalog-variables.controller";
import { Category } from "../categories/entities/category.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Catalog,
      CatalogVariable,
      CatalogVariableOption,
      Category,
      Workflow,
    ]),
  ],
  controllers: [CatalogsController, CatalogVariablesController],
  providers: [CatalogsService, CatalogVariablesService],
  exports: [CatalogsService, CatalogVariablesService],
})
export class CatalogsModule {}
