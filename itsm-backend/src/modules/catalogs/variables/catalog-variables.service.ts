import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CatalogVariable } from "../entities/catalog-variable.entity";
import { CatalogVariableOption } from "../entities/catalog-variable-option.entity";
import { Catalog } from "../entities/catalog.entity";
import { CreateCatalogVariableDto } from "../dto/create-catalog-variable.dto";
import { UpdateCatalogVariableDto } from "../dto/update-catalog-variable.dto";

@Injectable()
export class CatalogVariablesService {
  constructor(
    @InjectRepository(CatalogVariable)
    private variablesRepo: Repository<CatalogVariable>,
    @InjectRepository(CatalogVariableOption)
    private optionsRepo: Repository<CatalogVariableOption>,
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

    const variable = this.variablesRepo.create({
      catalog,
      label: dto.label,
      fieldType: dto.fieldType,
      isMandatory: dto.isMandatory ?? false,
      defaultValue: dto.defaultValue,
      sortOrder: dto.sortOrder ?? 0,
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
      relations: { options: true },
      order: { sortOrder: "ASC" },
    });
  }

  async findOne(
    catalogId: number,
    variableId: number
  ): Promise<CatalogVariable> {
    const variable = await this.variablesRepo.findOne({
      where: { variableId, catalog: { catalogId } },
      relations: { options: true },
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
    Object.assign(variable, dto);
    return this.variablesRepo.save(variable);
  }

  async remove(catalogId: number, variableId: number): Promise<void> {
    const variable = await this.findOne(catalogId, variableId);
    await this.variablesRepo.remove(variable);
  }
}
