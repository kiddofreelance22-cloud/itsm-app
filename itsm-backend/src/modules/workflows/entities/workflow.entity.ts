import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { WorkflowStep } from "./workflow-step.entity";

@Entity("workflows")
export class Workflow {
  @PrimaryGeneratedColumn({ name: "workflow_id" })
  workflowId: number;

  @Column({ name: "workflow_name" })
  workflowName: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @OneToMany(() => WorkflowStep, (step) => step.workflow, { cascade: true })
  steps: WorkflowStep[];
}
