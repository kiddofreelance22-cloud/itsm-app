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
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { ProblemsModule } from "./modules/problems/problems.module";
import { ChangesModule } from "./modules/changes/changes.module";

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
    DashboardModule, TasksModule, ProblemsModule, ChangesModule,
  ],
})
export class AppModule {}
