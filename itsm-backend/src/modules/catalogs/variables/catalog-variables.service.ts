import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CatalogVariable } from "../entities/catalog-variable.entity";
import { CatalogVariableOption } from "../entities/catalog-variable-option.entity";
import { CatalogFormSection } from "../entities/catalog-form-section.entity";
import { Catalog } from "../entities/catalog.entity";
import { CreateCatalogVariableDto } from "../dto/create-catalog-variable.dto";
import { UpdateCatalogVariableDto } from "../dto/update-catalog-variable.dto";
import { ReorderVariablesDto } from "../dto/reorder-variables.dto";

@Injectable()
export class CatalogVariablesService {
  constructor(
    @InjectRepository(CatalogVariable)
    private variablesRepo: Repository<CatalogVariable>,
    @InjectRepository(CatalogVariableOption)
    private optionsRepo: Repository<CatalogVariableOption>,
    @InjectRepository(CatalogFormSection)
    private sectionsRepo: Repository<CatalogFormSection>,
    @InjectRepository(Catalog) private catalogsRepo: Repository<Catalog>
  ) {}

  async create(
    catalogId: number,
    dto: CreateCatalogVariableDto
  ): Promise<CatalogVariable> {
    const catalog = await this.catalogsRepo.findOne({
      where: { catalogId },
    });
    if (!catalog) {
      throw new NotFoundException(`Catalog ${catalogId} not found`);
    }

    const section = await this.resolveSection(catalogId, dto.sectionId);

    const variable = this.variablesRepo.create({
      catalog,
      section,
      sectionName: section?.name ?? "General",
      label: dto.label,
      fieldType: dto.fieldType,
      isMandatory: dto.isMandatory ?? false,
      defaultValue: dto.defaultValue,
      placeholder: dto.placeholder,
      helpText: dto.helpText,
      isVisible: dto.isVisible ?? true,
      readOnly: dto.readOnly ?? false,
      sortOrder: dto.sortOrder ?? 0,
      minValue: dto.minValue,
      maxValue: dto.maxValue,
      validationRegex: dto.validationRegex,
      dateMin: dto.dateMin,
      dateMax: dto.dateMax,
      allowedFileTypes: dto.allowedFileTypes,
      maxFileSizeMb: dto.maxFileSizeMb,
      lookupSource: dto.lookupSource,
    });
    const saved = await this.variablesRepo.save(variable);

    if (dto.options?.length) {
      const options = dto.options.map((opt, idx) =>
        this.optionsRepo.create({
          variable: saved,
          optionLabel: opt.optionLabel,
          optionValue: opt.optionValue,
          sortOrder: idx,
        })
      );
      await this.optionsRepo.save(options);
    }

    return this.findOne(catalogId, saved.variableId);
  }

  findAllForCatalog(catalogId: number): Promise<CatalogVariable[]> {
    return this.variablesRepo.find({
      where: { catalog: { catalogId } },
      relations: { options: true, section: true },
      order: { sortOrder: "ASC" },
    });
  }

  async findOne(
    catalogId: number,
    variableId: number
  ): Promise<CatalogVariable> {
    const variable = await this.variablesRepo.findOne({
      where: { variableId, catalog: { catalogId } },
      relations: { options: true, section: true },
    });
    if (!variable) {
      throw new NotFoundException(
        `Variable ${variableId} not found on catalog ${catalogId}`
      );
    }
    return variable;
  }

  async update(
    catalogId: number,
    variableId: number,
    dto: UpdateCatalogVariableDto
  ): Promise<CatalogVariable> {
    const variable = await this.findOne(catalogId, variableId);
    const { sectionId, options, ...rest } = dto;
    Object.assign(variable, rest);

    if (sectionId !== undefined) {
      const section = await this.resolveSection(catalogId, sectionId);
      variable.section = section;
      variable.sectionName = section?.name ?? "General";
    }

    const saved = await this.variablesRepo.save(variable);

    if (options !== undefined) {
      // Replace the full option set — simplest way to keep add/remove/
      // reorder from the editor consistent without diffing individual rows.
      await this.optionsRepo.delete({ variable: { variableId: saved.variableId } });
      if (options.length) {
        const newOptions = options.map((opt, idx) =>
          this.optionsRepo.create({
            variable: saved,
            optionLabel: opt.optionLabel,
            optionValue: opt.optionValue,
            sortOrder: opt.sortOrder ?? idx,
          })
        );
        await this.optionsRepo.save(newOptions);
      }
    }

    return this.findOne(catalogId, variableId);
  }

  async remove(catalogId: number, variableId: number): Promise<void> {
    const variable = await this.findOne(catalogId, variableId);
    await this.variablesRepo.remove(variable);
  }

  /** Persists drag-reorder results — sortOrder and, optionally, a section move. */
  async reorder(catalogId: number, dto: ReorderVariablesDto): Promise<CatalogVariable[]> {
    for (const entry of dto.variables) {
      const patch: Record<string, unknown> = { sortOrder: entry.sortOrder };
      if (entry.sectionId !== undefined) {
        const section = entry.sectionId ? await this.resolveSection(catalogId, entry.sectionId) : null;
        patch.section = section ?? null;
        patch.sectionName = section?.name ?? "General";
      }
      await this.variablesRepo.update(
        { variableId: entry.variableId, catalog: { catalogId } },
        patch
      );
    }
    return this.findAllForCatalog(catalogId);
  }

  private async resolveSection(
    catalogId: number,
    sectionId: number | null | undefined
  ): Promise<CatalogFormSection | undefined> {
    if (!sectionId) return undefined;
    const section = await this.sectionsRepo.findOne({
      where: { sectionId, catalog: { catalogId } },
    });
    if (!section) throw new NotFoundException(`Section ${sectionId} not found on catalog ${catalogId}`);
    return section;
  }
}
