import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinColumn, JoinTable, CreateDateColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("assignment_groups")
export class AssignmentGroup {
  @PrimaryGeneratedColumn({ name: "group_id" }) groupId: number;
  @Column({ name: "group_name" }) groupName: string;
  @Column({ name: "group_code", unique: true }) groupCode: string;
  @Column({ nullable: true }) description: string;
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "manager_id" }) manager: User | null;
  @ManyToMany(() => User)
  @JoinTable({ name: "assignment_group_members", joinColumn: { name: "group_id" }, inverseJoinColumn: { name: "user_id" } })
  members: User[];
  @Column({ name: "is_active", default: true }) isActive: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
