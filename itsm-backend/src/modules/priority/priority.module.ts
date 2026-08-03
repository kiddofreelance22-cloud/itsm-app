import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Priority } from "./entities/priority.entity";
import { PriorityService } from "./priority.service";
import { PriorityController } from "./priority.controller";
@Module({
  imports: [TypeOrmModule.forFeature([Priority])],
  controllers: [PriorityController],
  providers: [PriorityService],
  exports: [PriorityService],
})
export class PriorityModule {}
