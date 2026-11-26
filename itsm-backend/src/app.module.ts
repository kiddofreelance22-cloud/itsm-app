import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import configuration from "./config/configuration";
import { validationSchema } from "./config/validation.schema";
import { buildDatabaseConfig } from "./config/database.config";
import { MailModule } from "./modules/mail/mail.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesModule } from "./modules/roles/roles.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { WorkflowsModule } from "./modules/workflows/workflows.module";
import { CatalogsModule } from "./modules/catalogs/catalogs.module";
import { RequestsModule } from "./modules/requests/requests.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { StatusModule } from "./modules/status/status.module";
import { PriorityModule } from "./modules/priority/priority.module";
import { ImpactModule } from "./modules/impact/impact.module";
import { UrgencyModule } from "./modules/urgency/urgency.module";
import { SubCategoryModule } from "./modules/sub-category/sub-category.module";
import { AssignmentGroupModule } from "./modules/assignment-group/assignment-group.module";
import { LocationModule } from "./modules/location/location.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { ProblemsModule } from "./modules/problems/problems.module";
import { ChangesModule } from "./modules/changes/changes.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { ServiceCategoriesModule } from "./modules/service-categories/service-categories.module";
import { ServiceImpactsModule } from "./modules/service-impacts/service-impacts.module";
import { ServicePrioritiesModule } from "./modules/service-priorities/service-priorities.module";
import { ServiceUrgenciesModule } from "./modules/service-urgencies/service-urgencies.module";
import { ServiceCompletionsModule } from "./modules/service-completions/service-completions.module";
import { RequestMastersModule } from "./modules/request-masters/request-masters.module";
import { RequestConfigModule } from "./modules/request-config/request-config.module";
import { IncidentConfigModule } from "./modules/incident-config/incident-config.module";
import { ItsmConfigModule } from "./modules/itsm-config/itsm-config.module";
import { ChatModule } from "./modules/chat/chat.module";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module";
import { CsmModule } from "./modules/csm/csm.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], validationSchema }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: buildDatabaseConfig }),
    MailModule, AuthModule, UsersModule, RolesModule,
    CategoriesModule, WorkflowsModule, CatalogsModule,
    RequestsModule, IncidentsModule,
    StatusModule, PriorityModule, ImpactModule, UrgencyModule,
    SubCategoryModule, AssignmentGroupModule, LocationModule,
    DepartmentsModule,
    DashboardModule, TasksModule, ProblemsModule, ChangesModule,
    UploadsModule,
    ServiceCategoriesModule, ServiceImpactsModule, ServicePrioritiesModule, ServiceUrgenciesModule, ServiceCompletionsModule, RequestMastersModule, RequestConfigModule,
    IncidentConfigModule, ItsmConfigModule, ChatModule, KnowledgeModule, CsmModule,
  ],
})
export class AppModule {}
