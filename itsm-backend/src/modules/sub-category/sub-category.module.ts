import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SubCategory } from "./entities/sub-category.entity";
import { Category } from "../categories/entities/category.entity";
import { SubCategoryService } from "./sub-category.service";
import { SubCategoryController } from "./sub-category.controller";

@Module({
  imports: [TypeOrmModule.forFeature([SubCategory, Category])],
  controllers: [SubCategoryController],
  providers: [SubCategoryService],
  exports: [SubCategoryService],
})
export class SubCategoryModule {}
