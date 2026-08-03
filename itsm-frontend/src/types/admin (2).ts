export interface ModulePermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  administer: boolean;
}

export interface Role {
  roleId: number;
  roleName: string;
  roleCode?: string;
  description?: string;
  isActive: boolean;
  userCount?: number;
  permissions?: Record<string, ModulePermissions>;
}

export interface UserRole {
  userRoleId: number;
  role: Role;
  assignedAt: string;
}

export interface AdminUser {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  isActive: boolean;
  userRoles: UserRole[];
}

export interface Category {
  categoryId: number;
  categoryName: string;
  description?: string;
  parent: { categoryId: number; categoryName: string } | null;
  children: Category[];
  isActive: boolean;
}
