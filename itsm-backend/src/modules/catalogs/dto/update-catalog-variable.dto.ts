import { PartialType } from "@nestjs/swagger";
import { CreateCatalogVariableDto } from "./create-catalog-variable.dto";

// Unlike the original version of this DTO, options are NOT omitted here —
// CatalogVariablesService.update() now replaces a variable's option set
// when `options` is present, which is what the Variables tab's option
// editor (add/remove/rename option rows on an existing dropdown/multi_select/
// checkbox/radio variable) needs in order to actually persist.
export class UpdateCatalogVariableDto extends PartialType(CreateCatalogVariableDto) {}
