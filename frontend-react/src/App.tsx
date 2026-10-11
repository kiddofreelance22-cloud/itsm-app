import React from "react";
import { useAuth } from "./AuthContext";
import { Shell } from "./components/Shell";
import { ApproveIncidentRecordsPage } from "./screens/ApproveIncidentRecords";
import { CreateIncidentPage, CreateIncidentForUserPage } from "./screens/CreateIncident";
import { CreateUserPage } from "./screens/CreateUser";
import { FeedbackModerationPage } from "./screens/FeedbackModeration";
import { AdminMasterPage } from "./screens/AdminMaster";
import { FieldVisibilityConfigPage } from "./screens/FieldVisibilityConfig";
import { IncidentDetailPage } from "./screens/IncidentDetail";
import { IncidentRecordPage } from "./screens/IncidentRecord";
import { IncidentQueuePage } from "./screens/IncidentQueue";
import { LoginPage } from "./screens/Login";
import { ManageIncidentsPage } from "./screens/ManageIncidents";
import { MyIncidentsPage } from "./screens/MyIncidents";
import { ServiceRequestsPage } from "./screens/ServiceRequests";
import { ServiceRequestListPage } from "./screens/ServiceRequestList";
import { AdminCatalogsPage } from "./screens/AdminCatalogs";
import { AdminServiceRequestForm } from "./screens/AdminServiceRequestForm";
import { WorkOrderListPage } from "./screens/WorkOrderList";
import { ChecklistsPage } from "./screens/ChecklistConfig";
import { PriorityMatrixPage } from "./screens/PriorityMatrix";
import { SlaMatrixPage } from "./screens/SlaMatrix";
import { WorkgroupSlaPage } from "./screens/WorkgroupSla";
import { CategoryConfigPage } from "./screens/CategoryConfig";
import { WoChecklistPage, OnHoldReasonsPage, ResolutionCodesPage, ClosureCodesPage, PendingReasonsPage, ImpactPage, UrgencyPage, PriorityPage, StatusPage } from "./screens/MasterListPage";
import { SlaServiceWindowPage, RolesPage } from "./screens/ServiceWindowAndRoles";
import { LogIncidentPageConfigPage } from "./screens/LogIncidentPageConfig";
import { ClassificationConfigPage } from "./screens/ClassificationConfig";
import { StatusTransitionMatrixPage } from "./screens/StatusTransitionMatrix";
import { MandatoryFieldRulesPage, ApprovalConfigurationPage } from "./screens/RulePages";
import { EmailNotificationPage } from "./screens/EmailNotification";
import { DirectorySettingsPage, AttributeMappingPage, SyncHistoryPage } from "./screens/DirectoryPages";
import { UserDashboardPage } from "./screens/UserDashboard";
import { ResolverDashboardPage } from "./screens/ResolverDashboard";
import { AdminDashboardPage } from "./screens/AdminDashboard";
import { Route, useRouter } from "./router";

function DefaultRedirect() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  React.useEffect(() => {
    if (!user) return;
    if (user.role === "END_USER") navigate("/my-dashboard");
    else if (user.role === "ADMIN") navigate("/admin-dashboard");
    else navigate("/resolver-dashboard");
  }, [user]);
  return <div className="spinner-row">Loading…</div>;
}

// The router renders every matching <Route>, so the generic master screen must
// step aside whenever a dedicated screen owns the slug.
const DEDICATED_MASTERS = new Set([
  "priority-matrix", "sla-matrix", "workgroup-sla", "categories", "classification", "checklist", "checklists",
  "on-hold-reasons", "resolution-code", "mandatory-field-rules", "approval-config", "status-transitions",
  "email-notification", "directory-settings", "attribute-mapping", "sync-history", "closure-code", "pending-reason", "impact", "urgency",
  "priority", "status", "sla-service-window", "roles", "log-incident-page",
]);
function MasterFallback() {
  const { path } = useRouter();
  const slug = path.split("/").filter(Boolean)[2] ?? "";
  return DEDICATED_MASTERS.has(slug) ? null : <AdminMasterPage />;
}

export function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="spinner-row">Loading…</div>;
  if (!user) return <LoginPage />;

  return (
    <Shell>
      <Route path="/"><DefaultRedirect /></Route>
      <Route path="/my-dashboard"><UserDashboardPage /></Route>
      <Route path="/resolver-dashboard"><ResolverDashboardPage /></Route>
      <Route path="/admin-dashboard"><AdminDashboardPage /></Route>
      <Route path="/my-incidents"><MyIncidentsPage /></Route>
      <Route path="/my-incidents/:id"><IncidentDetailPage /></Route>
      <Route path="/service-requests"><ServiceRequestsPage /></Route>
      <Route path="/service-requests/my-requests"><ServiceRequestListPage /></Route>
      <Route path="/service-requests/my-requests/:id"><ServiceRequestListPage /></Route>
      <Route path="/admin/requests"><ServiceRequestListPage admin /></Route>
      <Route path="/admin/requests/:id"><ServiceRequestListPage admin /></Route>
      <Route path="/admin/create-service-request"><AdminServiceRequestForm /></Route>
      <Route path="/admin/edit-service-request/:id"><AdminServiceRequestForm editing /></Route>
      <Route path="/admin/catalogs"><AdminCatalogsPage /></Route>
      <Route path="/new-incident"><CreateIncidentPage /></Route>
      <Route path="/new-incident-for-user"><CreateIncidentForUserPage /></Route>
      <Route path="/incidents"><ManageIncidentsPage /></Route>
      <Route path="/incident-queue"><IncidentQueuePage /></Route>
      <Route path="/incidents/:id"><IncidentRecordPage /></Route>
      <Route path="/work-orders"><WorkOrderListPage /></Route>
      <Route path="/feedback"><FeedbackModerationPage /></Route>
      <Route path="/approvals"><ApproveIncidentRecordsPage /></Route>
      <Route path="/config/field-visibility"><FieldVisibilityConfigPage /></Route>
      <Route path="/config/admin/users/create"><CreateUserPage /></Route>
      <Route path="/config/admin/users/:id/edit"><CreateUserPage /></Route>
      <Route path="/config/admin/priority-matrix"><PriorityMatrixPage /></Route>
      <Route path="/config/admin/sla-matrix"><SlaMatrixPage /></Route>
      <Route path="/config/admin/workgroup-sla"><WorkgroupSlaPage /></Route>
      <Route path="/config/admin/classification"><ClassificationConfigPage /></Route>
      <Route path="/config/admin/closure-code"><ClosureCodesPage /></Route>
      <Route path="/config/admin/pending-reason"><PendingReasonsPage /></Route>
      <Route path="/config/admin/impact"><ImpactPage /></Route>
      <Route path="/config/admin/urgency"><UrgencyPage /></Route>
      <Route path="/config/admin/priority"><PriorityPage /></Route>
      <Route path="/config/admin/status"><StatusPage /></Route>
      <Route path="/config/admin/sla-service-window"><SlaServiceWindowPage /></Route>
      <Route path="/config/admin/roles"><RolesPage /></Route>
      <Route path="/config/admin/log-incident-page"><LogIncidentPageConfigPage /></Route>
      <Route path="/config/admin/checklist"><WoChecklistPage /></Route>
      <Route path="/config/admin/checklists"><ChecklistsPage /></Route>
      <Route path="/config/admin/on-hold-reasons"><OnHoldReasonsPage /></Route>
      <Route path="/config/admin/resolution-code"><ResolutionCodesPage /></Route>
      <Route path="/config/admin/mandatory-field-rules"><MandatoryFieldRulesPage /></Route>
      <Route path="/config/admin/approval-config"><ApprovalConfigurationPage /></Route>
      <Route path="/config/admin/status-transitions"><StatusTransitionMatrixPage /></Route>
      <Route path="/config/admin/email-notification"><EmailNotificationPage /></Route>
      <Route path="/config/admin/directory-settings"><DirectorySettingsPage /></Route>
      <Route path="/config/admin/attribute-mapping"><AttributeMappingPage /></Route>
      <Route path="/config/admin/sync-history"><SyncHistoryPage /></Route>
      <Route path="/config/admin/categories"><CategoryConfigPage /></Route>
      <Route path="/config/admin/:master"><MasterFallback /></Route>
    </Shell>
  );
}
