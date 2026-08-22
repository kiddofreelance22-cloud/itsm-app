// Incident detail types for the incident detail page

export interface IncidentAttachment {
  id: string;
  fileName: string;
  sizeLabel: string;
  downloadUrl: string;
  previewUrl: string;
}

export interface User {
  userId?: number;
  fullName?: string;
  phone?: string;
  email?: string;
  department?: string;
}

export interface Category {
  categoryId?: number;
  categoryName?: string;
}

export interface SubCategory {
  subCategoryId?: number;
  name?: string;
}

export interface AssignmentGroup {
  groupId?: number;
  groupName?: string;
}

export interface Location {
  locationId?: number;
  locationName?: string;
}

export interface Asset {
  assetId?: number;
  assetTag?: string;
}

export interface BusinessService {
  serviceId?: number;
  name?: string;
}

export interface SLAInfo {
  summary?: string;
  responseTargetAt?: string;
  responseMet?: boolean;
  respondedInLabel?: string;
  resolutionTargetAt?: string;
  resolutionPercentElapsed?: number;
  elapsedLabel?: string;
  withinSla?: boolean;
}

export interface IncidentDetail {
  incidentId: string;
  title: string;
  status: string;
  priority: string;
  impact?: string;
  urgency?: string;
  category?: Category;
  subCategory?: SubCategory;
  assignmentGroup?: AssignmentGroup;
  assignedTo?: User;
  location?: Location;
  asset?: Asset;
  description: string;
  attachments?: IncidentAttachment[];
  createdBy?: User;
  createdAt: string;
  businessService?: BusinessService;
  sla?: SLAInfo;
  relatedProblems?: Array<{ id: string; title: string }>;
  relatedChanges?: Array<{ id: string; title: string }>;
}

export interface Activity {
  activityId: string;
  type: string;
  content?: string | null;
  createdAt: string;
  author?: User;
  meta?: Record<string, string>;
  isWorkNote?: boolean;
}
