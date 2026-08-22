import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Change } from "./entities/change.entity";
import { User } from "../users/entities/user.entity";
import { ChangesService } from "./changes.service";
import { ChangesController } from "./changes.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Change, User])],
  controllers: [ChangesController],
  providers: [ChangesService],
  exports: [ChangesService],
})
export class ChangesModule {}
