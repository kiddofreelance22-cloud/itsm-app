/** Roles that work incidents. Everyone else is a requester and may only see/touch their own. */
export const STAFF_ROLES = ["Admin", "Administrator", "IT Agent", "IT Manager", "Service Desk", "Engineer"];

/**
 * Admin-defined roles (e.g. "IT Engineer", "L2 Support Analyst") have free-form
 * names, so a fixed list can never recognise them. Any role whose name contains
 * one of these words is treated as a resolver/staff role. Keep this in sync with
 * normalizeRole() in the frontend (incidentApi.ts).
 */
export const STAFF_ROLE_PATTERN = /(engineer|agent|analyst|support|resolver|fulfiller|technician|specialist|desk|manager)/i;

export const isStaffRoleName = (role: string): boolean =>
  STAFF_ROLES.includes(role) || STAFF_ROLE_PATTERN.test(role);

export const isStaff = (roles: string[] | undefined | null): boolean => (roles ?? []).some(isStaffRoleName);
