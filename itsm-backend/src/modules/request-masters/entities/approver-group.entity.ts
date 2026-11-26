import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("approver_groups")
export class ApproverGroup {
  @PrimaryGeneratedColumn({ name: "approver_group_id" }) approverGroupId!: number;
  @Column({ name: "group_name", unique: true }) groupName!: string;
  @Column({ type: "text", nullable: true }) description?: string | null;
  @Column({ name: "is_active", default: true }) isActive!: boolean;
  @ManyToMany(() => User)
  @JoinTable({ name: "approver_group_members", joinColumn: { name: "approver_group_id" }, inverseJoinColumn: { name: "user_id" } })
  members!: User[];
  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
