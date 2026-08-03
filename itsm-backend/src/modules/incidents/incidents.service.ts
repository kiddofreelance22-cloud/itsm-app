import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Incident } from "./entities/incident.entity";
import { Category } from "../categories/entities/category.entity";
import { User } from "../users/entities/user.entity";
import { ServiceRequest } from "../requests/entities/request.entity";
import { CreateIncidentDto } from "./dto/create-incident.dto";
import { UpdateIncidentDto } from "./dto/update-incident.dto";

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident) private incidentsRepo: Repository<Incident>,
    @InjectRepository(Category) private categoriesRepo: Repository<Category>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(ServiceRequest)
    private requestsRepo: Repository<ServiceRequest>
  ) {}

  async create(
    createdByUserId: number,
    dto: CreateIncidentDto
  ): Promise<Incident> {
    const createdBy = await this.usersRepo.findOne({
      where: { userId: createdByUserId },
    });
    if (!createdBy) {
      throw new NotFoundException(`User ${createdByUserId} not found`);
    }

    let category: Category | null = null;
    if (dto.categoryId) {
      category = await this.categoriesRepo.findOne({
        where: { categoryId: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category ${dto.categoryId} not found`);
      }
    }

    let request: ServiceRequest | null = null;
    if (dto.requestId) {
      request = await this.requestsRepo.findOne({
        where: { requestId: dto.requestId },
      });
      if (!request) {
        throw new NotFoundException(`Request ${dto.requestId} not found`);
      }
    }

    const [lastIncident] = await this.incidentsRepo.find({
      order: { createdAt: "DESC" },
      take: 1,
    });
    
    let nextNum = 1;
    if (lastIncident && lastIncident.incidentId.startsWith("INC")) {
      const match = lastIncident.incidentId.match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }
    const newId = `INC${String(nextNum).padStart(3, "0")}`;

    const incident = this.incidentsRepo.create({
      incidentId: newId,
      title: dto.title,
      description: dto.description,
      category,
      priority: dto.priority ?? "Medium",
      status: "Open",
      createdBy,
      request,
    });

    return this.incidentsRepo.save(incident);
  }

  findAllForUser(userId: number): Promise<Incident[]> {
    return this.incidentsRepo.find({
      where: { createdBy: { userId } },
      relations: { category: true, assignedTo: true },
      order: { createdAt: "DESC" },
    });
  }

  findAll(): Promise<Incident[]> {
    return this.incidentsRepo.find({
      relations: { category: true, assignedTo: true, createdBy: true },
      order: { createdAt: "DESC" },
    });
  }

  async findOne(incidentId: string): Promise<Incident> {
    const incident = await this.incidentsRepo.findOne({
      where: { incidentId },
      relations: {
        category: true,
        assignedTo: true,
        createdBy: true,
        request: true,
      },
    });
    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }
    return incident;
  }

  async update(
    incidentId: string,
    dto: UpdateIncidentDto
  ): Promise<Incident> {
    const incident = await this.findOne(incidentId);

    if (dto.assignedTo !== undefined) {
      incident.assignedTo = dto.assignedTo
        ? await this.usersRepo.findOne({ where: { userId: dto.assignedTo } })
        : null;
    }

    if (dto.status === "Resolved" && incident.status !== "Resolved") {
      incident.resolvedAt = new Date();
    }

    const { assignedTo, ...rest } = dto;
    Object.assign(incident, rest);

    return this.incidentsRepo.save(incident);
  }

  async remove(incidentId: string): Promise<void> {
    const incident = await this.findOne(incidentId);
    await this.incidentsRepo.remove(incident);
  }
}
