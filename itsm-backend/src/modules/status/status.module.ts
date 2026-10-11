import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StatusVersion } from "./entities/status-version.entity";
import { Status } from "./entities/status.entity";
import { StatusService } from "./status.service";
import { StatusController } from "./status.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Status, StatusVersion])],
  controllers: [StatusController],
  providers: [StatusService],
  exports: [StatusService],
})
export class StatusModule {}
