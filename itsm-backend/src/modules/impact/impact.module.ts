import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Impact } from "./entities/impact.entity";
import { ImpactService } from "./impact.service";
import { ImpactController } from "./impact.controller";
@Module({
  imports: [TypeOrmModule.forFeature([Impact])],
  controllers: [ImpactController],
  providers: [ImpactService],
  exports: [ImpactService],
})
export class ImpactModule {}
