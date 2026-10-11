import { PartialType } from "@nestjs/swagger";
import { CreateCatalogSectionDto } from "./create-catalog-section.dto";

export class UpdateCatalogSectionDto extends PartialType(CreateCatalogSectionDto) {}
