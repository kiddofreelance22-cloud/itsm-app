export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "dropdown"
  | "checkbox"
  | "radio";

export interface CatalogVariableOption {
  optionId: number;
  optionLabel: string;
  optionValue: string;
  sortOrder: number;
}

export interface CatalogVariable {
  variableId: number;
  label: string;
  fieldType: FieldType;
  isMandatory: boolean;
  defaultValue?: string;
  sortOrder: number;
  isActive: boolean;
  options: CatalogVariableOption[];
}

export interface CatalogCategory {
  categoryId: number;
  categoryName: string;
}

export interface CatalogWorkflow {
  workflowId: number;
  workflowName: string;
}

export interface Catalog {
  catalogId: number;
  catalogName: string;
  shortDescription?: string;
  description?: string;
  category: CatalogCategory;
  iconUrl?: string;
  workflow?: CatalogWorkflow | null;
  isActive: boolean;
  variables: CatalogVariable[];
}
