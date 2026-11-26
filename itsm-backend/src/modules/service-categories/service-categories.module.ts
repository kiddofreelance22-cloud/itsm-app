import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { ServiceCategory } from "./entities/service-category.entity";
import { ServiceCategoriesController } from "./service-categories.controller";
import { ServiceCategoriesService } from "./service-categories.service";

@Module({
  imports: [TypeOrmModule.forFeature([ServiceCategory, Catalog])],
  controllers: [ServiceCategoriesController],
  providers: [ServiceCategoriesService],
  exports: [ServiceCategoriesService],
})
export class ServiceCategoriesModule {}