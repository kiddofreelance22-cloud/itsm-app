import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateCatalogVariableDto } from "./create-catalog-variable.dto";

export class UpdateCatalogVariableDto extends PartialType(
  OmitType(CreateCatalogVariableDto, ["options"] as const)
) {}
