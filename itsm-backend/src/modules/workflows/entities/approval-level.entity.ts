import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { WorkflowStep } from "./workflow-step.entity";
import { AssignmentGroup } from "../../assignment-group/entities/assignment-group.entity";

export type ApproverType = "user" | "group" | "role" | "custom";

@Entity("approval_levels")
export class ApprovalLevel {
  @PrimaryGeneratedColumn({ name: "approval_level_id" })
  approvalLevelId!: number;

  @ManyToOne(() => WorkflowStep, { onDelete: "CASCADE" })
  @JoinColumn({ name: "activity_id" })
  activity!: WorkflowStep;

  @Column({ name: "level_number" })
  levelNumber!: number;

  @Column({ name: "title" })
  title!: string;

  @Column({ name: "approver_type" })
  approverType!: ApproverType;

  @Column({ name: "approver_id", nullable: true })
  approverId?: number;

  @Column({ name: "auto_approval", default: false })
  autoApproval!: boolean;

  @Column({ name: "email_notifications_for_end_user", default: false })
  emailNotificationsForEndUser!: boolean;

  @Column({ name: "refer_back_to_requestor", default: false })
  referBackToRequestor!: boolean;

  @Column({ name: "refer_back_to_previous_approvers", default: false })
  referBackToPreviousApprovers!: boolean;

  @ManyToOne(() => AssignmentGroup, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "custom_group_id" })
  customGroup?: AssignmentGroup;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
