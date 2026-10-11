import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("directory_sources")
export class DirectorySource {
  @PrimaryGeneratedColumn({ name: "source_id" }) sourceId!: number;
  @Column() type!: "ldap" | "azure_ad";
  @Column() name!: string;
  @Column({ name: "is_active", default: false }) isActive!: boolean;
  @Column({ name: "auto_create_users", default: false }) autoCreateUsers!: boolean;

  @Column({ name: "ldap_url", type: "varchar", nullable: true }) ldapUrl!: string | null;
  @Column({ name: "bind_dn", type: "varchar", nullable: true }) bindDn!: string | null;
  /** AES-256-GCM encrypted — never returned by the API. */
  @Column({ name: "bind_password", type: "text", nullable: true, select: false }) bindPassword!: string | null;
  @Column({ name: "base_dn", type: "varchar", nullable: true }) baseDn!: string | null;
  @Column({ name: "search_filter", type: "varchar", nullable: true }) searchFilter!: string | null;
  @Column({ name: "default_role", type: "varchar", nullable: true }) defaultRole!: string | null;

  @Column({ name: "tenant_id", type: "varchar", nullable: true }) tenantId!: string | null;
  @Column({ name: "client_id", type: "varchar", nullable: true }) clientId!: string | null;
  /** AES-256-GCM encrypted — never returned by the API. */
  @Column({ name: "client_secret", type: "text", nullable: true, select: false }) clientSecret!: string | null;
  @Column({ name: "redirect_uri", type: "varchar", nullable: true }) redirectUri!: string | null;
  @Column({ name: "sso_enabled", default: false }) ssoEnabled!: boolean;
  @Column({ name: "sso_only", default: false }) ssoOnly!: boolean;
  @Column({ name: "allowed_domains", type: "text", nullable: true }) allowedDomains!: string | null;

  @Column({ name: "last_test_ok", type: "boolean", nullable: true }) lastTestOk!: boolean | null;
  @Column({ name: "last_test_message", type: "text", nullable: true }) lastTestMessage!: string | null;
  @Column({ name: "last_tested_at", type: "timestamp", nullable: true }) lastTestedAt!: Date | null;

  @CreateDateColumn({ name: "created_at" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
