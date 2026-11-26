import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Change } from "./entities/change.entity";
import { ChangeApproval } from "./entities/change-approval.entity";
import { ChangeTask } from "./entities/change-task.entity";
import { ChangeWorkNote } from "./entities/change-work-note.entity";
import { CabMeeting } from "./entities/cab-meeting.entity";
import { ChangeSetting } from "./entities/change-setting.entity";
import { ChangeNotificationLog } from "./entities/change-notification-log.entity";
import { User } from "../users/entities/user.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { ChangesService } from "./changes.service";
import { ChangesController } from "./changes.controller";
import { CabService } from "./cab.service";
import { ChangeConfigService } from "./change-config.service";
import { ChangeNotifier } from "./change-notifier.service";
import { ChangeJobsWorker } from "./change-jobs.worker";

@Module({
  imports: [TypeOrmModule.forFeature([Change, ChangeApproval, ChangeTask, ChangeWorkNote, CabMeeting, ChangeSetting, ChangeNotificationLog, User, AssignmentGroup])],
  controllers: [ChangesController],
  providers: [ChangesService, CabService, ChangeConfigService, ChangeNotifier, ChangeJobsWorker],
  exports: [ChangesService],
})
export class ChangesModule {}
