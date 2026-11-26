import React from "react";
import { useAuth } from "./AuthContext";
import { ChatWidget } from "./components/ChatWidget";
import { Shell } from "./components/Shell";
import { MyApprovalsPage } from "./screens/MyApprovals";
import { ApproveIncidentRecordsPage } from "./screens/ApproveIncidentRecords";
import { NotificationsPage } from "./screens/Notifications";
import { CreateIncidentPage, CreateIncidentForUserPage } from "./screens/CreateIncident";
import { CreateUserPage } from "./screens/CreateUser";
import { FeedbackModerationPage } from "./screens/FeedbackModeration";
import { ChatbotFeedbackPage } from "./screens/ChatbotFeedback";
import { AdminMasterPage } from "./screens/AdminMaster";
import { FieldVisibilityConfigPage } from "./screens/FieldVisibilityConfig";
import { IncidentDetailPage } from "./screens/IncidentDetail";
import { IncidentRecordPage } from "./screens/IncidentRecord";
import { IncidentQueuePage } from "./screens/IncidentQueue";
import { LoginPage } from "./screens/Login";
import { SsoCallbackPage } from "./screens/SsoCallback";
import { ManageIncidentsPage } from "./screens/ManageIncidents";
import { MyIncidentsPage } from "./screens/MyIncidents";
import { ServiceRequestsPage, ServiceRequestFormPage } from "./screens/ServiceRequests";
import { ServiceRequestListPage } from "./screens/ServiceRequestList";
import { ServiceRequestQueuePage } from "./screens/ServiceRequestQueue";
import { ServiceRequestRecordPage } from "./screens/ServiceRequestRecord";
import { ServiceRequestApprovalsPage } from "./screens/ServiceRequestApprovals";
import { ServiceCategoryPage } from "./screens/ServiceCategory";
import { LifecyclePage } from "./screens/Lifecycle";
import { ServiceCatalogBuilderPage } from "./screens/ServiceCatalogBuilder";
import { RequestEmailNotificationPage, RequestPriorityMatrixPage, RequestStatusConfigPage, ServiceImpactPage } from "./screens/RequestConfig";
import { AdminCatalogsPage } from "./screens/AdminCatalogs";
import { AdminServiceRequestForm } from "./screens/AdminServiceRequestForm";
import { WorkOrderListPage } from "./screens/WorkOrderList";
import { ChecklistsPage } from "./screens/ChecklistConfig";
import { PriorityMatrixPage } from "./screens/PriorityMatrix";
import { SlaMatrixPage } from "./screens/SlaMatrix";
import { WorkgroupSlaPage } from "./screens/WorkgroupSla";
import { CategoryConfigPage } from "./screens/CategoryConfig";
import { WoChecklistPage, OnHoldReasonsPage, ResolutionCodesPage, ClosureCodesPage, PendingReasonsPage, ImpactPage, UrgencyPage, PriorityPage, ServicePriorityPage, ServiceUrgencyPage, RequestPendingReasonPage, StatusPage } from "./screens/MasterListPage";
import { SlaServiceWindowPage, RequestSlaServiceWindowPage, RolesPage } from "./screens/ServiceWindowAndRoles";
import { LogIncidentPageConfigPage } from "./screens/LogIncidentPageConfig";
import { ClassificationConfigPage } from "./screens/ClassificationConfig";
import { StatusTransitionMatrixPage } from "./screens/StatusTransitionMatrix";
import { MandatoryFieldRulesPage, ApprovalConfigurationPage } from "./screens/RulePages";
import { EmailNotificationPage } from "./screens/EmailNotification";
import { DirectorySettingsPage, AttributeMappingPage, SyncHistoryPage } from "./screens/DirectoryPages";
import { UserDashboardPage } from "./screens/UserDashboard";
import { ProfilePage } from "./screens/Profile";
import { ResolverDashboardPage } from "./screens/ResolverDashboard";
import { AdminDashboardPage } from "./screens/AdminDashboard";
import { ChangeListPage } from "./screens/ChangeList";
import { ChangeNewPage } from "./screens/ChangeNew";
import { ChangeRecordPage } from "./screens/ChangeRecord";
import { ChangeApprovalsPage } from "./screens/ChangeApprovals";
import { ChangeSchedulePage } from "./screens/ChangeSchedule";
import { CabWorkbenchPage } from "./screens/CabWorkbench";
import { ChangeOverviewPage } from "./screens/ChangeOverview";
import { ChangeModelsPage } from "./screens/ChangeConfigModels";
import { ChangeCategoriesPage } from "./screens/ChangeConfigCategories";
import { ChangeCloseCodesPage } from "./screens/ChangeConfigCloseCodes";
import { ChangeRiskPage } from "./screens/ChangeConfigRisk";
import { ChangeCatalogPage } from "./screens/ChangeConfigCatalog";
import { ChangeApprovalPolicyPage } from "./screens/ChangeConfigApproval";
import { ChangeLifecyclePage } from "./screens/ChangeConfigLifecycle";
import { ChangeWindowsPage } from "./screens/ChangeConfigWindows";
import { ChangeNotificationsPage } from "./screens/ChangeConfigNotifications";
import { SkmsDashboardPage, KedbPage, ArticleHealthPage, KcsLeaderboardPage, WorkflowSimulatorPage } from "./screens/Knowledge";
import { KnowledgeBasePage, KnowledgeArticlePage } from "./screens/KnowledgeBase";
import { KnowledgeArticleDetailsPage, KnowledgeArticleEditorPage } from "./screens/KnowledgeArticleEditor";
import {
  CsmCasesPage, CsmCaseCreatePage, CsmCaseDetailsPage, CsmContractsPage, CsmCustomerCreatePage,
  CsmCustomerHealthPage, CsmCustomerProfilePage, CsmCustomersPage, CsmDashboardPage, CsmEscalationCreatePage,
  CsmEscalationsPage, CsmLifecyclePage, CsmMajorCaseCreatePage, CsmMajorCasesPage,
} from "./screens/Csm";
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

function GroupsRedirect() {
  const { navigate } = useRouter();
  React.useEffect(() => {
    navigate("/config/admin/groups");
  }, []);
  return <div className="spinner-row">Loading groups…</div>;
}

// The router renders every matching <Route>, so the generic master screen must
// step aside whenever a dedicated screen owns the slug.
const DEDICATED_MASTERS = new Set([
  "priority-matrix", "sla-matrix", "workgroup-sla", "categories", "classification", "checklist", "checklists",
  "on-hold-reasons", "resolution-code", "mandatory-field-rules", "approval-config", "status-transitions",
  "email-notification", "directory-settings", "attribute-mapping", "sync-history", "closure-code", "pending-reason", "impact", "urgency",
  "priority", "status", "sla-service-window", "roles", "log-incident-page",
  "service-category", "lifecycles", "knowledge-lifecycles", "service-impact", "service-priority", "service-urgency", "request-pending-reason", "request-priority-matrix", "request-status", "approver-groups", "request-email-notification", "request-sla-service-window",
]);
function MasterFallback() {
  const { path } = useRouter();
  const slug = path.split("/").filter(Boolean)[2] ?? "";
  return DEDICATED_MASTERS.has(slug) ? null : <AdminMasterPage />;
}

export function App() {
  const { user, loading } = useAuth();
  const { path } = useRouter();

  if (path === "/auth/callback") return <SsoCallbackPage />;
  if (loading) return <div className="spinner-row">Loading…</div>;
  if (!user) return <LoginPage />;

  return (
    <Shell>
      <ChatWidget />
      <Route path="/"><DefaultRedirect /></Route>
      <Route path="/my-dashboard"><UserDashboardPage /></Route>
      <Route path="/resolver-dashboard"><ResolverDashboardPage /></Route>
      <Route path="/admin-dashboard"><AdminDashboardPage /></Route>
      <Route path="/profile"><ProfilePage /></Route>
      <Route path="/my-incidents"><MyIncidentsPage /></Route>
      <Route path="/my-incidents/:id"><IncidentDetailPage /></Route>
      <Route path="/service-requests"><ServiceRequestsPage /></Route>
      <Route path="/service-requests/request/:id"><ServiceRequestFormPage /></Route>
      <Route path="/service-requests/my-requests"><ServiceRequestListPage /></Route>
      <Route path="/service-requests/my-requests/:id"><ServiceRequestListPage /></Route>
      <Route path="/service-requests/queue"><ServiceRequestQueuePage /></Route>
      <Route path="/service-requests/queue/:id"><ServiceRequestRecordPage /></Route>
      <Route path="/service-requests/approvals"><ServiceRequestApprovalsPage /></Route>
      <Route path="/service-requests/approvals/:id"><ServiceRequestApprovalsPage /></Route>
      <Route path="/admin/requests"><ServiceRequestQueuePage /></Route>
      <Route path="/admin/requests/:id"><ServiceRequestRecordPage /></Route>
      <Route path="/admin/create-service-request"><AdminServiceRequestForm /></Route>
      <Route path="/admin/edit-service-request/:id"><AdminServiceRequestForm editing /></Route>
      <Route path="/admin/catalogs"><AdminCatalogsPage /></Route>
      <Route path="/admin/catalog-builder"><ServiceCatalogBuilderPage /></Route>
      <Route path="/admin/request-pending-reason"><RequestPendingReasonPage /></Route>
      <Route path="/changes"><ChangeListPage /></Route>
      <Route path="/changes/overview"><ChangeOverviewPage /></Route>
      <Route path="/changes/config/models"><ChangeModelsPage /></Route>
      <Route path="/changes/config/categories"><ChangeCategoriesPage /></Route>
      <Route path="/changes/config/close-codes"><ChangeCloseCodesPage /></Route>
      <Route path="/changes/config/risk"><ChangeRiskPage /></Route>
      <Route path="/changes/config/catalog"><ChangeCatalogPage /></Route>
      <Route path="/changes/config/approval"><ChangeApprovalPolicyPage /></Route>
      <Route path="/changes/config/groups"><GroupsRedirect /></Route>
      <Route path="/changes/config/lifecycle"><ChangeLifecyclePage /></Route>
      <Route path="/changes/config/windows"><ChangeWindowsPage /></Route>
      <Route path="/changes/config/notifications"><ChangeNotificationsPage /></Route>
      <Route path="/changes/new"><ChangeNewPage /></Route>
      <Route path="/changes/approvals"><ChangeApprovalsPage /></Route>
      <Route path="/changes/approvals/:id"><ChangeApprovalsPage /></Route>
      <Route path="/changes/schedule"><ChangeSchedulePage /></Route>
      <Route path="/changes/cab"><CabWorkbenchPage /></Route>
      <Route path="/changes/:id"><ChangeRecordPage /></Route>
      <Route path="/changes/:id/edit"><ChangeNewPage editing /></Route>
      <Route path="/knowledge"><SkmsDashboardPage /></Route>
      <Route path="/knowledge/articles/new/:type"><KnowledgeArticleEditorPage /></Route>
      <Route path="/knowledge/articles/:id/edit"><KnowledgeArticleEditorPage editing /></Route>
      <Route path="/knowledge/articles/:id"><KnowledgeArticleDetailsPage /></Route>
      <Route path="/knowledge/kedb"><KedbPage /></Route>
      <Route path="/knowledge/health"><ArticleHealthPage /></Route>
      <Route path="/knowledge/leaderboard"><KcsLeaderboardPage /></Route>
      <Route path="/knowledge/simulator"><WorkflowSimulatorPage /></Route>
      <Route path="/knowledge-base"><KnowledgeBasePage /></Route>
      <Route path="/knowledge-base/:id"><KnowledgeArticlePage /></Route>
      <Route path="/csm/dashboard"><CsmDashboardPage /></Route>
      <Route path="/csm/case-lifecycle"><CsmLifecyclePage /></Route>
      <Route path="/csm/cases"><CsmCasesPage /></Route>
      <Route path="/csm/case-views"><CsmCasesPage /></Route>
      <Route path="/csm/cases/new"><CsmCaseCreatePage /></Route>
      <Route path="/csm/cases/new/:type"><CsmCaseCreatePage /></Route>
      <Route path="/csm/cases/:id"><CsmCaseDetailsPage /></Route>
      <Route path="/csm/escalations"><CsmEscalationsPage /></Route>
      <Route path="/csm/escalations/new"><CsmEscalationCreatePage /></Route>
      <Route path="/csm/major-cases"><CsmMajorCasesPage /></Route>
      <Route path="/csm/major-cases/new"><CsmMajorCaseCreatePage /></Route>
      <Route path="/csm/customers"><CsmCustomersPage /></Route>
      <Route path="/csm/customers/new"><CsmCustomerCreatePage /></Route>
      <Route path="/csm/customers/:id"><CsmCustomerProfilePage /></Route>
      <Route path="/csm/customer-health"><CsmCustomerHealthPage /></Route>
      <Route path="/csm/contracts"><CsmContractsPage /></Route>
      <Route path="/new-incident"><CreateIncidentPage /></Route>
      <Route path="/new-incident-for-user"><CreateIncidentForUserPage /></Route>
      <Route path="/incidents"><ManageIncidentsPage /></Route>
      <Route path="/incident-queue"><IncidentQueuePage /></Route>
      <Route path="/incidents/:id"><IncidentRecordPage /></Route>
      <Route path="/work-orders"><WorkOrderListPage /></Route>
      <Route path="/feedback"><FeedbackModerationPage /></Route>
      <Route path="/admin/chat-feedback"><ChatbotFeedbackPage /></Route>
      <Route path="/approvals"><MyApprovalsPage /></Route>
      <Route path="/incident-approvals"><ApproveIncidentRecordsPage /></Route>
      <Route path="/incident-approvals/:id"><ApproveIncidentRecordsPage /></Route>
      <Route path="/notifications"><NotificationsPage /></Route>
      <Route path="/config/field-visibility"><FieldVisibilityConfigPage /></Route>
      <Route path="/config/admin/users/create"><CreateUserPage /></Route>
      <Route path="/config/admin/users/:id/edit"><CreateUserPage /></Route>
      <Route path="/config/admin/groups"><AdminMasterPage /></Route>
      <Route path="/config/admin/priority-matrix"><PriorityMatrixPage /></Route>
      <Route path="/config/admin/sla-matrix"><SlaMatrixPage /></Route>
      <Route path="/config/admin/workgroup-sla"><WorkgroupSlaPage /></Route>
      <Route path="/config/admin/classification"><ClassificationConfigPage /></Route>
      <Route path="/config/admin/closure-code"><ClosureCodesPage /></Route>
      <Route path="/config/admin/pending-reason"><PendingReasonsPage /></Route>
      <Route path="/config/admin/impact"><ImpactPage /></Route>
      <Route path="/config/admin/urgency"><UrgencyPage /></Route>
      <Route path="/config/admin/priority"><PriorityPage /></Route>
      <Route path="/config/admin/service-priority"><ServicePriorityPage /></Route>
      <Route path="/config/admin/service-urgency"><ServiceUrgencyPage /></Route>
      <Route path="/config/admin/request-pending-reason"><RequestPendingReasonPage /></Route>
      <Route path="/config/admin/status"><StatusPage /></Route>
      <Route path="/config/admin/sla-service-window"><SlaServiceWindowPage /></Route>
      <Route path="/config/admin/request-sla-service-window"><RequestSlaServiceWindowPage /></Route>
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
      <Route path="/config/admin/service-category"><ServiceCategoryPage /></Route>
      <Route path="/config/admin/lifecycles"><LifecyclePage /></Route>
      <Route path="/config/admin/knowledge-lifecycles"><LifecyclePage scope="knowledge" /></Route>
      <Route path="/config/admin/service-impact"><ServiceImpactPage /></Route>
      <Route path="/config/admin/request-priority-matrix"><RequestPriorityMatrixPage /></Route>
      <Route path="/config/admin/request-status"><RequestStatusConfigPage /></Route>
      <Route path="/config/admin/approver-groups"><GroupsRedirect /></Route>
      <Route path="/config/admin/workgroups"><GroupsRedirect /></Route>
      <Route path="/config/admin/request-email-notification"><RequestEmailNotificationPage /></Route>
      <Route path="/config/admin/:master"><MasterFallback /></Route>
    </Shell>
  );
}
