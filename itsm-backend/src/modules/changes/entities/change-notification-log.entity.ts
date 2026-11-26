import { Entity, PrimaryColumn, CreateDateColumn } from "typeorm";

/** De-duplicates time-based notifications (reminders, 24-hour notices, overruns) so each is sent once. */
@Entity("change_notification_log")
export class ChangeNotificationLog {
  @PrimaryColumn({ name: "dedupe_key" }) key!: string;
  @CreateDateColumn({ name: "sent_at" }) sentAt!: Date;
}
