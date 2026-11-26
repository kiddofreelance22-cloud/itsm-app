import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { CatalogVariable } from "../catalogs/entities/catalog-variable.entity";
import { Category } from "../categories/entities/category.entity";
import { Classification } from "../itsm-config/entities/classification.entity";
import { Impact } from "../impact/entities/impact.entity";
import { Incident } from "../incidents/entities/incident.entity";
import { IncidentsModule } from "../incidents/incidents.module";
import { RequestsModule } from "../requests/requests.module";
import { ServiceRequest } from "../requests/entities/request.entity";
import { Urgency } from "../urgency/entities/urgency.entity";
import { Priority } from "../priority/entities/priority.entity";
import { SubCategory } from "../sub-category/entities/sub-category.entity";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ChatToolsService } from "./chat-tools.service";
import { ChatKnowledgeService } from "./chat-knowledge.service";
import { ChatMessage, ChatSession } from "./entities/chat.entity";
import { ChatPendingAction } from "./entities/chat-pending-action.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatSession,
      ChatMessage,
      ChatPendingAction,
      Catalog,
      CatalogVariable,
      Category,
      Classification,
      SubCategory,
      Impact,
      Priority,
      Incident,
      ServiceRequest,
      Urgency,
    ]),
    IncidentsModule,
    RequestsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatToolsService, ChatKnowledgeService],
})
export class ChatModule {}
