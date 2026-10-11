import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CatalogFormSection } from "../entities/catalog-form-section.entity";
import { Catalog } from "../entities/catalog.entity";
import { CreateCatalogSectionDto } from "../dto/create-catalog-section.dto";
import { UpdateCatalogSectionDto } from "../dto/update-catalog-section.dto";
import { ReorderSectionsDto } from "../dto/reorder-sections.dto";

@Injectable()
export class CatalogSectionsService {
  constructor(
    @InjectRepository(CatalogFormSection)
    private sectionsRepo: Repository<CatalogFormSection>,
    @InjectRepository(Catalog) private catalogsRepo: Repository<Catalog>
  ) {}

  findAll(catalogId: number): Promise<CatalogFormSection[]> {
    return this.sectionsRepo.find({
      where: { catalog: { catalogId } },
      order: { displayOrder: "ASC" },
    });
  }

  async create(catalogId: number, dto: CreateCatalogSectionDto): Promise<CatalogFormSection> {
    const catalog = await this.catalogsRepo.findOne({ where: { catalogId } });
    if (!catalog) throw new NotFoundException(`Catalog ${catalogId} not found`);

    const displayOrder = dto.displayOrder ?? (await this.nextDisplayOrder(catalogId));
    const section = this.sectionsRepo.create({
      catalog,
      name: dto.name,
      description: dto.description,
      displayOrder,
    });
    return this.sectionsRepo.save(section);
  }

  async update(
    catalogId: number,
    sectionId: number,
    dto: UpdateCatalogSectionDto
  ): Promise<CatalogFormSection> {
    const section = await this.findOne(catalogId, sectionId);
    Object.assign(section, dto);
    return this.sectionsRepo.save(section);
  }

  async remove(catalogId: number, sectionId: number): Promise<void> {
    const section = await this.findOne(catalogId, sectionId);
    // Variables in this section aren't deleted — the FK is ON DELETE SET
    // NULL, so they fall back to the "General" pseudo-section instead of
    // disappearing.
    await this.sectionsRepo.remove(section);
  }

  async reorder(catalogId: number, dto: ReorderSectionsDto): Promise<CatalogFormSection[]> {
    for (const entry of dto.sections) {
      await this.sectionsRepo.update(
        { sectionId: entry.sectionId, catalog: { catalogId } },
        { displayOrder: entry.displayOrder }
      );
    }
    return this.findAll(catalogId);
  }

  private async findOne(catalogId: number, sectionId: number): Promise<CatalogFormSection> {
    const section = await this.sectionsRepo.findOne({
      where: { sectionId, catalog: { catalogId } },
    });
    if (!section) {
      throw new NotFoundException(`Section ${sectionId} not found on catalog ${catalogId}`);
    }
    return section;
  }

  private async nextDisplayOrder(catalogId: number): Promise<number> {
    const result = await this.sectionsRepo
      .createQueryBuilder("s")
      .where("s.catalog_id = :catalogId", { catalogId })
      .select("MAX(s.displayOrder)", "max")
      .getRawOne<{ max: number | null }>();
    return (result?.max ?? -1) + 1;
  }
}
