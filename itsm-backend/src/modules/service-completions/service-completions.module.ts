import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServiceCompletion } from "./entities/service-completion.entity";
import { ServiceCompletionsController } from "./service-completions.controller";
import { ServiceCompletionsService } from "./service-completions.service";

@Module({
  imports: [TypeOrmModule.forFeature([ServiceCompletion])],
  controllers: [ServiceCompletionsController],
  providers: [ServiceCompletionsService],
  exports: [ServiceCompletionsService],
})
export class ServiceCompletionsModule {}