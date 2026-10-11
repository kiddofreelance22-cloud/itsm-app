import { apiFetch } from "./client";
import { AdminUser } from "@/types/admin";

export interface CreateUserDto {
  username: string;
  email: string;
  password?: string;
  fullName?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  phone?: string;
  workPhone?: string;
  mobilePhone?: string;
  alternateEmail?: string;
  employeeId?: string;
  jobTitle?: string;
  departmentId?: number;
  managerName?: string;
  businessService?: string;
  location?: string;
  costCenter?: string;
  building?: string;
  floor?: string;
  deskNumber?: string;
  userType?: "Internal" | "External" | "Partner";
  authType?: "Internal" | "LDAP" | "SAML" | "OAuth";
  ssoEnabled?: boolean;
  isActive?: boolean;
  allowMobileAccess?: boolean;
  allowApiAccess?: boolean;
  allowLogin?: boolean;
  reviewRequired?: boolean;
  passwordExpiryDays?: number | null;
  roleId?: number;
  assignmentGroupId?: number;
  defaultLandingPage?: string;
  workAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  language?: string;
  dateFormat?: string;
  timeZone?: string;
  notes?: string;
}

export type UpdateUserDto = Partial<CreateUserDto>;

export const UsersApi = {
  list: () => apiFetch<AdminUser[]>("/users"),
  getOne: (id: number) => apiFetch<AdminUser>(`/users/${id}`),
  create: (body: CreateUserDto) =>
    apiFetch<AdminUser>("/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: number, body: UpdateUserDto) =>
    apiFetch<AdminUser>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  remove: (id: number) =>
    apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
  deactivate: (id: number) =>
    apiFetch<AdminUser>(`/users/${id}/deactivate`, { method: "PATCH" }),
};
