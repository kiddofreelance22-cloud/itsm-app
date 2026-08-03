export interface Role { 
  roleId: number; 
  roleName: string; 
  roleCode: string;
  description?: string; 
  isActive: boolean;
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Permission {
  permissionId: number;
  moduleName: string;
  permissionType: "Read" | "Create" | "Update" | "Delete" | "Admin";
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface RolePermission {
  rolePermissionId: number;
  roleId: number;
  permissionId: number;
  createdAt: string;
}

export interface UserRole { userRoleId: number; role: Role; assignedAt: string; }
export interface AdminUser {
  userId: number; username: string; email: string; fullName: string;
  phone?: string; isActive: boolean; userRoles: UserRole[];
}
export interface Category {
  categoryId: number; categoryName: string; description?: string;
  parent: { categoryId: number; categoryName: string } | null;
  children: Category[]; isActive: boolean;
}
export interface Status {
  statusId: number; statusName: string; statusCode: string;
  type: string; isOpen: boolean; isActive: boolean; createdAt: string;
}
export interface Priority {
  priorityId: number; priorityName: string; priorityCode: string;
  description?: string; order: number; isActive: boolean;
}
export interface Impact {
  impactId: number; impactName: string; impactCode: string;
  description?: string; order: number; isActive: boolean;
}
export interface Urgency {
  urgencyId: number; urgencyName: string; urgencyCode: string;
  description?: string; order: number; isActive: boolean;
}
export interface SubCategory {
  subCategoryId: number; subCategoryName: string; subCategoryCode: string;
  description?: string;
  category: { categoryId: number; categoryName: string } | null;
  isActive: boolean;
}
export interface AssignmentGroup {
  groupId: number; groupName: string; groupCode: string;
  description?: string;
  manager: { userId: number; fullName: string } | null;
  members: { userId: number; fullName: string }[];
  isActive: boolean;
}
export interface Location {
  locationId: number; locationName: string; locationCode: string;
  type: string; description?: string; isActive: boolean;
}

export interface ModulePermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  administer: boolean;
}