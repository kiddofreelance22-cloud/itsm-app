import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import { ServiceCategory } from "./entities/service-category.entity";
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from "./dto/service-category.dto";

@Injectable()
export class ServiceCategoriesService {
  constructor(@InjectRepository(ServiceCategory) private readonly repo: Repository<ServiceCategory>) {}

  async create(dto: CreateServiceCategoryDto) {
    const categoryName = dto.categoryName.trim();
    if (await this.repo.findOne({ where: { categoryName: ILike(categoryName) } })) {
      throw new ConflictException(`Service category "${categoryName}" already exists`);
    }
    const { parentCategoryName, ...data } = dto;
    const parentCategory = parentCategoryName?.trim()
      ? await this.repo.findOne({ where: { categoryName: ILike(parentCategoryName.trim()) } })
      : undefined;
    return this.repo.save(this.repo.create({ ...data, parentCategoryId: parentCategory?.serviceCategoryId, categoryName }));
  }

  async findAll() {
    const items = await this.repo.find({ relations: { parentCategory: true }, order: { sortOrder: "ASC", categoryName: "ASC" } });
    return items.map((item) => ({ ...item, parentCategoryName: item.parentCategory?.categoryName }));
  }

  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { serviceCategoryId: id } });
    if (!item) throw new NotFoundException(`Service category ${id} not found`);
    return item;
  }

  async update(id: number, dto: UpdateServiceCategoryDto) {
    const item = await this.findOne(id);
    if (dto.categoryName) {
      const categoryName = dto.categoryName.trim();
      const conflict = await this.repo.findOne({ where: { categoryName: ILike(categoryName) } });
      if (conflict && conflict.serviceCategoryId !== id) throw new ConflictException(`Service category "${categoryName}" already exists`);
      dto.categoryName = categoryName;
    }
    const { parentCategoryName, ...data } = dto;
    if (parentCategoryName !== undefined) {
      const parentCategory = parentCategoryName.trim()
        ? await this.repo.findOne({ where: { categoryName: ILike(parentCategoryName.trim()) } })
        : undefined;
      data.parentCategoryId = parentCategory?.serviceCategoryId;
    }
    Object.assign(item, data);
    return this.repo.save(item);
  }

  async remove(id: number) { await this.repo.remove(await this.findOne(id)); }
}