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
  firstName?: string;
  lastName?: string;
  displayName?: string;
  profilePhotoUrl?: string;
  // Contact
  phone?: string;
  workPhone?: string;
  mobilePhone?: string;
  alternateEmail?: string;
  // Organisation
  employeeId?: string;
  jobTitle?: string;
  departmentId?: number;
  department?: { departmentId: number; departmentName: string; departmentCode: string } | null;
  managerName?: string;
  businessService?: string;
  location?: string;
  costCenter?: string;
  building?: string;
  floor?: string;
  deskNumber?: string;
  // Account
  userType: "Internal" | "External" | "Partner";
  authType: "Internal" | "LDAP" | "SAML" | "OAuth";
  ssoEnabled: boolean;
  isActive: boolean;
  allowMobileAccess: boolean;
  allowApiAccess: boolean;
  allowLogin: boolean;
  reviewRequired: boolean;
  passwordExpiryDays?: number | null;
  // Role & access
  primaryRole?: Role | null;
  assignmentGroup?: { groupId: number; groupName: string } | null;
  defaultLandingPage: string;
  userRoles: UserRole[];
  // Address
  workAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  // Emergency
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  // Preferences
  language: string;
  dateFormat: string;
  timeZone: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryScope {
  workgroupIds: number[] | null;
  locationIds: number[] | null;
  memberIds: number[] | null;
  inherited: boolean;
}
export interface Category {
  categoryId: number; nodeUuid?: string; categoryName: string; categoryCode?: string; description?: string;
  parent: { categoryId: number; categoryName: string } | null; parentCategoryId?: number | null;
  children: Category[]; displayOrder: number; icon?: string; isActive: boolean;
  availableInPortal: boolean; availableInMobile: boolean;
  showInCatalog: boolean; allowInIncident: boolean;
  materializedPath?: string;
  defaultAssignmentGroup?: { groupId: number; groupName: string } | null;
  workgroupIds?: number[] | null; locationIds?: number[] | null; memberIds?: number[] | null;
  effectiveScope?: CategoryScope;
  createdAt?: string; updatedAt?: string;
}
export interface Status {
  statusId: number; statusName: string; statusCode: string;
  type: string; isOpen: boolean; isActive: boolean; createdAt: string;
}
export interface Priority {
  priorityId: number; priorityName: string; priorityCode: string;
  description?: string; order: number; isActive: boolean;
  responseSlaMinutes?: number; resolutionSlaMinutes?: number;
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
  isDefault: boolean;
}
export interface Location {
  locationId: number; locationName: string; locationCode: string;
  type: string; description?: string; isActive: boolean;
}
export interface ServiceCategory {
  serviceCategoryId: number; categoryName: string; parentCategoryId?: number | null; parentCategoryName?: string;
  description?: string; imageUrl?: string; tileColor: string; sortOrder: number; isActive: boolean;
}
export interface ServiceImpact {
  serviceImpactId: number; impactName: string; sortOrder: number; isDefault: boolean; isActive: boolean;
}
export interface ServicePriority {
  priorityId: number; priorityName: string; priorityCode: string;
  description?: string; responseSlaMinutes?: number; resolutionSlaMinutes?: number;
  order: number; color?: string; isActive: boolean;
}
export interface ServiceUrgency {
  urgencyId: number; urgencyName: string; urgencyCode: string;
  description?: string; order: number; color?: string; isActive: boolean;
}
export interface RequestSlaServiceWindow {
  slaServiceWindowId: number; slaName: string; holidayCalendarLocation?: string;
  useAnalystWorkLocation: boolean; timeZone: string; isDefault: boolean; isActive: boolean;
  is24x7: boolean; serviceWindow: ServiceWindowDay[];
}
export interface ServiceCompletion {
  serviceCompletionId: number; completionName: string; description?: string;
  sortOrder: number; isDefault: boolean; isActive: boolean;
}
export interface ClosureCode { closureCodeId: number; closureCodeName: string; isActive: boolean; }
export interface PendingReason { pendingReasonId: number; pendingReasonName: string; isActive: boolean; }
export interface RequestPendingReason {
  pendingReasonId: number;
  pendingReasonName: string;
  description?: string;
  slaImpact?: "pause" | "continue";
  isActive: boolean;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}
export interface PriorityMatrix {
  priorityMatrixId: number; urgencyId: number; impactId: number; priorityId: number;
  urgency: Urgency; impact: Impact; priority: Priority; isActive: boolean;
}
export interface ServiceWindowDay { day: number; enabled: boolean; from: string; to: string; }
export interface SlaServiceWindow {
  slaServiceWindowId: number; slaName: string; holidayCalendarLocation?: string;
  useAnalystWorkLocation: boolean; timeZone: string; isDefault: boolean; isActive: boolean;
  is24x7: boolean; serviceWindow: ServiceWindowDay[];
}
export interface ModulePermissions {
  read: boolean; create: boolean; update: boolean; delete: boolean; administer: boolean;
}
