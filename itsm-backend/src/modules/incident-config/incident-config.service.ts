import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FieldVisibilityItemDto } from "./dto/update-field-visibility.dto";
import { IncidentFieldVisibility } from "./entities/incident-field-visibility.entity";

const DEFAULT_FIELDS: FieldVisibilityItemDto[] = [
  { field_name: "Short Description", section: "Incident", visible: true },
  { field_name: "Created Date", section: "Incident", visible: true },
  { field_name: "Status", section: "Incident", visible: true },
  { field_name: "Priority", section: "Incident", visible: true },
  { field_name: "Category", section: "Incident", visible: true },
  { field_name: "Incident Number", section: "Incident", visible: true },
  { field_name: "Assigned Workgroup", section: "Assignment", visible: true },
  { field_name: "Assigned Agent", section: "Assignment", visible: true },
  { field_name: "Description", section: "Incident", visible: true },
  { field_name: "Resolution Notes", section: "Resolution", visible: true },
  { field_name: "Closure Code", section: "Resolution", visible: true },
  { field_name: "Feedback / Rating", section: "Feedback", visible: true },
];

@Injectable()
export class IncidentConfigService {
  constructor(
    @InjectRepository(IncidentFieldVisibility)
    private readonly fieldsRepo: Repository<IncidentFieldVisibility>,
  ) {}

  async findFieldVisibility(): Promise<IncidentFieldVisibility[]> {
    const fields = await this.fieldsRepo.find({ order: { section: "ASC", fieldName: "ASC" } });
    return fields.length ? fields : DEFAULT_FIELDS.map((field) => this.fieldsRepo.create(field));
  }

  async replaceFieldVisibility(fields: FieldVisibilityItemDto[]): Promise<IncidentFieldVisibility[]> {
    await this.fieldsRepo.manager.transaction(async (manager) => {
      await manager.createQueryBuilder().delete().from(IncidentFieldVisibility).execute();
      if (fields.length) {
        await manager.save(
          IncidentFieldVisibility,
          fields.map(({ field_name, ...field }) => ({ ...field, fieldName: field_name })),
        );
      }
    });
    return this.findFieldVisibility();
  }
}