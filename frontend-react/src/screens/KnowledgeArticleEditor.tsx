import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  FileText,
  Info,
  Paperclip,
  ShieldCheck,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { ErrorBar, errMsg, formatDate } from "../components/configKit";
import { fetchLookupOptions } from "../lookupSources";
import { useAsync } from "../hooks";
import { Link, useRouteParams, useRouter } from "../router";
import {
  knowledgeApi,
  type KnowledgeAttachment,
  type ArticleStatus,
  type ArticleType,
  type KnowledgeLifecycleOption,
  type NewArticleInput,
  type Severity,
  type Urgency,
} from "../knowledgeApi";
import { StaffOnly, TagList, useIsStaff } from "./KnowledgeShared";

const SERVICE_LINES = ["Cloud Infrastructure", "Identity & Access", "Enterprise Applications", "Network Services"];
const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "Low", label: "Low - Minor Friction" },
  { value: "Medium", label: "Medium - Departmental Impact" },
  { value: "High", label: "High - Enterprise Wide" },
  { value: "Critical", label: "Critical - Enterprise Critical" },
];
const URGENCIES: Urgency[] = ["Low", "Medium", "High"];
const ARTICLE_STATUSES: ArticleStatus[] = ["Draft", "Published", "Pending Archive", "Archived"];
const CATEGORIES = ["Incident", "Service Request", "Access", "Hardware", "Software", "Network"];
const SUBCATEGORIES = ["Connectivity", "Authentication", "Application", "Hardware", "Performance", "Other"];
const USER_GROUPS = ["All Employees (Global)", "VIP Executives Only", "Remote Workers", "Contractors / Vendors"];
const ANALYST_ROLES = ["All Service Desk Analysts", "Tier 2 & Tier 3 Specialists Only", "Problem Managers Only", "Change Approvers"];
const WORKGROUPS = ["Global Helpdesk", "Network Operations (NOC)", "Cloud Core Infra", "App Support"];
const LOCATIONS = ["Global / All Sites", "Headquarters (HQ)", "EMEA Regional Offices", "APAC Tech Hub"];
const DEPARTMENTS = ["All Departments", "Information Technology", "Finance & Accounting", "Human Resources"];
const EDITOR_STEPS = [
  { title: "Article Details", description: "Core article information" },
  { title: "Content & Solution", description: "Resolution or workaround" },
  { title: "Attachments & Links", description: "Supporting references" },
  { title: "Publishing & Access", description: "Audience and ownership" },
  { title: "Review & Publish", description: "Confirm before publishing" },
];
type EditorOptionKey =
  | "enableSelfServicePortal" | "enableAnalystConsole" | "featured" | "pinned"
  | "includeSearchIndex" | "allowComments" | "captureUsage" | "enableRating"
  | "autoSuggestIncident" | "enableAiSummaryTags" | "enableSimilarSuggestions" | "allowVersionComparison";
type EditorOptions = Record<EditorOptionKey, boolean>;
const DEFAULT_EDITOR_OPTIONS: EditorOptions = {
  enableSelfServicePortal: true,
  enableAnalystConsole: true,
  featured: false,
  pinned: false,
  includeSearchIndex: true,
  allowComments: false,
  captureUsage: true,
  enableRating: true,
  autoSuggestIncident: true,
  enableAiSummaryTags: false,
  enableSimilarSuggestions: false,
  allowVersionComparison: false,
};
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const PRIORITY_MATRIX: Record<Severity, Record<Urgency, string>> = {
  Low: { Low: "P4 - Low", Medium: "P3 - Medium", High: "P3 - Medium" },
  Medium: { Low: "P3 - Medium", Medium: "P3 - Medium", High: "P2 - High" },
  High: { Low: "P3 - Medium", Medium: "P2 - High", High: "P1 - Critical" },
  Critical: { Low: "P2 - High", Medium: "P1 - Critical", High: "P1 - Critical" },
};

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="field-group">
      <label className="lbl">{label}</label>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

function SettingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="knowledge-setting-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function KnowledgeArticleEditorPage({ editing = false }: { editing?: boolean }) {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const staff = useIsStaff();
  const newParams = useRouteParams("/knowledge/articles/new/:type");
  const editParams = useRouteParams("/knowledge/articles/:id/edit");
  const id = Number(editParams?.id);
  const validId = Number.isInteger(id) && id > 0;
  const [type, setType] = useState<ArticleType>(newParams?.type === "known-error" ? "Known Error" : "Standard KB");
  const [serviceLine, setServiceLine] = useState(SERVICE_LINES[3]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [problemCode, setProblemCode] = useState("");
  const [relatedArticleCode, setRelatedArticleCode] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subcategory, setSubcategory] = useState(SUBCATEGORIES[0]);
  const [service, setService] = useState("");
  const [configurationItem, setConfigurationItem] = useState("");
  const [group, setGroup] = useState(USER_GROUPS[0]);
  const [analystRole, setAnalystRole] = useState(ANALYST_ROLES[0]);
  const [workgroup, setWorkgroup] = useState(WORKGROUPS[0]);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [severity, setSeverity] = useState<Severity>("Low");
  const [urgency, setUrgency] = useState<Urgency>("Medium");
  const [author, setAuthor] = useState(user?.name ?? "");
  const [ownerName, setOwnerName] = useState(user?.name ?? "");
  const [version, setVersion] = useState("v1.0");
  const [reviewDate, setReviewDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reviewers, setReviewers] = useState("");
  const [knowledgeLifecycles, setKnowledgeLifecycles] = useState<KnowledgeLifecycleOption[]>([]);
  const [knowledgeLifecyclesLoading, setKnowledgeLifecyclesLoading] = useState(false);
  const [knowledgeLifecyclesError, setKnowledgeLifecyclesError] = useState("");
  const [lifecycleWorkflowId, setLifecycleWorkflowId] = useState<number | null>(null);
  const [options, setOptions] = useState<EditorOptions>(DEFAULT_EDITOR_OPTIONS);
  const [resolution, setResolution] = useState("");
  const [serviceLines, setServiceLines] = useState(SERVICE_LINES);
  const [workgroups, setWorkgroups] = useState(WORKGROUPS);
  const [locations, setLocations] = useState(LOCATIONS);
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const [loadingArticle, setLoadingArticle] = useState(editing);
  const [articleStatus, setArticleStatus] = useState<ArticleStatus>(editing ? "Published" : "Draft");
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>([]);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [createdArticleId, setCreatedArticleId] = useState<number | null>(null);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const backTo = type === "Known Error" ? "/knowledge/kedb" : "/knowledge";

  useEffect(() => {
    if (!staff) return;
    let live = true;
    Promise.all([
      knowledgeApi.serviceLines(),
      fetchLookupOptions("groups", ""),
      fetchLookupOptions("locations", ""),
      fetchLookupOptions("departments", ""),
    ]).then(([lines, groups, locations, departments]) => {
      if (!live) return;
      setServiceLines(unique([...SERVICE_LINES, ...lines]));
      setWorkgroups(unique([...WORKGROUPS, ...groups.map((option) => option.label)]));
      setLocations(unique([...LOCATIONS, ...locations.map((option) => option.label)]));
      setDepartments(unique([...DEPARTMENTS, ...departments.map((option) => option.label)]));
    }).catch((e) => {
      if (live) setError(errMsg(e, "Some article options could not be loaded."));
    });
    return () => { live = false; };
  }, [staff]);

  useEffect(() => {
    if (!staff) return;
    let live = true;
    setKnowledgeLifecyclesLoading(true);
    setKnowledgeLifecyclesError("");
    knowledgeApi.lifecycles().then((lifecycles) => {
      if (live) setKnowledgeLifecycles(lifecycles);
    }).catch((e) => {
      if (live) setKnowledgeLifecyclesError(errMsg(e, "Knowledge lifecycles could not be loaded."));
    }).finally(() => {
      if (live) setKnowledgeLifecyclesLoading(false);
    });
    return () => { live = false; };
  }, [staff]);

  useEffect(() => {
    if (!staff) return;
    if (!editing) {
      setLoadingArticle(false);
      return;
    }
    if (!validId) {
      setError("Article not found.");
      setLoadingArticle(false);
      return;
    }
    let live = true;
    knowledgeApi.article(id).then((article) => {
      if (!live) return;
      setType(article.articleType);
      setServiceLine(article.serviceLine ?? "");
      setTitle(article.title);
      setSummary(article.summary ?? "");
      setTags(article.tags.join(", "));
      setProblemCode(article.problemCode ?? "");
      setRelatedArticleCode(article.relatedArticleCode ?? "");
      setCategory(article.category ?? CATEGORIES[0]);
      setSubcategory(article.subcategory ?? SUBCATEGORIES[0]);
      setService(article.service ?? "");
      setConfigurationItem(article.configurationItem ?? "");
      setGroup(article.audience.targetUserGroup ?? USER_GROUPS[0]);
      setAnalystRole(article.audience.analystRole ?? ANALYST_ROLES[0]);
      setWorkgroup(article.audience.workgroup ?? WORKGROUPS[0]);
      setLocation(article.audience.location ?? LOCATIONS[0]);
      setDepartment(article.audience.department ?? DEPARTMENTS[0]);
      setSeverity(article.severity);
      setUrgency(article.urgency);
      setAuthor(article.authorName ?? "");
      setOwnerName(article.ownerName ?? "");
      setVersion(article.version ?? "v1.0");
      setReviewDate(article.reviewDate?.slice(0, 10) ?? "");
      setExpiryDate(article.expiryDate?.slice(0, 10) ?? "");
      setReviewers(article.reviewers.join(", "));
      setLifecycleWorkflowId(article.lifecycleWorkflowId ?? null);
      setOptions({
        enableSelfServicePortal: article.enableSelfServicePortal,
        enableAnalystConsole: article.enableAnalystConsole,
        featured: article.featured,
        pinned: article.pinned,
        includeSearchIndex: article.includeSearchIndex,
        allowComments: article.allowComments,
        captureUsage: article.captureUsage,
        enableRating: article.enableRating,
        autoSuggestIncident: article.autoSuggestIncident,
        enableAiSummaryTags: article.enableAiSummaryTags,
        enableSimilarSuggestions: article.enableSimilarSuggestions,
        allowVersionComparison: article.allowVersionComparison,
      });
      setResolution(article.resolution);
      setArticleStatus(article.status);
      knowledgeApi.attachments(id).then((files) => {
        if (live) setAttachments(files);
      }).catch((e) => {
        if (live) setError(errMsg(e, "Could not load article attachments."));
      });
    }).catch((e) => {
      if (live) setError(errMsg(e, "Could not load this article."));
    }).finally(() => {
      if (live) setLoadingArticle(false);
    });
    return () => { live = false; };
  }, [editing, id, validId, staff]);

  const updateOption = (key: EditorOptionKey, value: boolean) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };
  const priority = PRIORITY_MATRIX[severity][urgency];
  const submitLabel = articleStatus === "Draft"
    ? editing ? "Save Draft" : "Save as Draft"
    : articleStatus === "Published" && !editing ? "Publish to SKMS" : "Save Changes";

  const addAttachments = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const allowed = new Set(["pdf", "docx", "xlsx", "txt", "png", "jpg", "jpeg"]);
    const invalid = files.find((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      return !allowed.has(extension) || file.size === 0 || file.size > 10 * 1024 * 1024;
    });
    if (invalid) {
      setError(`${invalid.name}: choose a non-empty PDF, DOCX, XLSX, TXT, PNG, or JPG file no larger than 10 MB.`);
      return;
    }
    setError("");
    const articleId = editing ? id : createdArticleId;
    if (!articleId) {
      setQueuedFiles((current) => [...current, ...files]);
      return;
    }
    setUploadingAttachments(true);
    try {
      for (const file of files) {
        const uploaded = await knowledgeApi.uploadAttachment(articleId, file);
        setAttachments((current) => [uploaded, ...current]);
      }
    } catch (e) {
      setError(errMsg(e, "Could not upload the attachment."));
    } finally {
      setUploadingAttachments(false);
    }
  };

  const removeAttachment = async (attachment: KnowledgeAttachment) => {
    const articleId = editing ? id : createdArticleId;
    if (!articleId) return;
    setUploadingAttachments(true);
    setError("");
    try {
      await knowledgeApi.deleteAttachment(articleId, attachment.attachmentId);
      setAttachments((current) => current.filter((file) => file.attachmentId !== attachment.attachmentId));
    } catch (e) {
      setError(errMsg(e, "Could not remove the attachment."));
    } finally {
      setUploadingAttachments(false);
    }
  };

  const downloadAttachment = async (attachment: KnowledgeAttachment) => {
    const articleId = editing ? id : createdArticleId;
    if (!articleId) {
      setError("Save the article before downloading its attachments.");
      return;
    }
    try {
      await knowledgeApi.downloadAttachment(articleId, attachment);
    } catch (e) {
      setError(errMsg(e, "Could not download the attachment."));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setStep(0);
      setError("Enter an article title or error symptom.");
      return;
    }
    if (!resolution.trim() && articleStatus !== "Draft") {
      setStep(0);
      setError("Provide the resolution or workaround steps.");
      return;
    }
    if (reviewDate && expiryDate && expiryDate < reviewDate) {
      setStep(0);
      setError("The expiry date must be on or after the review date.");
      return;
    }
    setSaving(true);
    setError("");
    let articleSaved = false;
    try {
      const input: NewArticleInput = {
        articleType: type,
        title: title.trim(),
        summary: summary.trim(),
        serviceLine,
        category,
        subcategory,
        service: service.trim(),
        configurationItem: configurationItem.trim(),
        relatedArticleCode: relatedArticleCode.trim(),
        tags: tags.split(","),
        audience: { targetUserGroup: group, analystRole, workgroup, location, department },
        severity,
        urgency,
        authorName: author.trim(),
        ownerName: ownerName.trim(),
        resolution: resolution.trim(),
        problemCode: type === "Known Error" ? problemCode.trim() : undefined,
        status: articleStatus,
        version: version.trim() || "v1.0",
        reviewDate: reviewDate || null,
        expiryDate: expiryDate || null,
        reviewers: reviewers.split(",").map((name) => name.trim()).filter(Boolean),
        lifecycleWorkflowId,
        ...options,
      };
      let articleId: number;
      if (editing) {
        await knowledgeApi.update(id, input);
        articleSaved = true;
        articleId = id;
      } else if (createdArticleId) {
        await knowledgeApi.update(createdArticleId, input);
        articleSaved = true;
        articleId = createdArticleId;
      } else {
        const created = await knowledgeApi.create(input);
        articleSaved = true;
        articleId = created.articleId;
        setCreatedArticleId(articleId);
      }
      for (const file of queuedFiles) {
        const uploaded = await knowledgeApi.uploadAttachment(articleId, file);
        setAttachments((current) => [uploaded, ...current]);
        setQueuedFiles((current) => current.filter((queued) => queued !== file));
      }
      navigate(backTo);
    } catch (e) {
      setError(errMsg(e, articleSaved ? "The article was saved, but an attachment could not be uploaded. Retry the upload." : editing ? "Could not save the article." : "Could not publish the article."));
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    if (step === 0 && !title.trim()) {
      setError("Enter an article title or error symptom before continuing.");
      return;
    }
    if (step === 0 && !resolution.trim() && articleStatus !== "Draft") {
      setError("Provide the resolution or workaround steps before continuing.");
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, EDITOR_STEPS.length - 1));
  };

  if (!staff) return <StaffOnly />;

  return (
    <>
      <div className="page-header knowledge-wizard-header">
        <div className="knowledge-wizard-heading">
          <div className="knowledge-wizard-mark"><BookOpen size={19} /></div>
          <div>
            <div className="knowledge-wizard-kicker">Knowledge Management</div>
            <div className="knowledge-wizard-title">{editing ? "Edit Knowledge Article" : "Create Knowledge Article"}</div>
            <div className="knowledge-wizard-subtitle">Build, categorize, and publish knowledge for SKMS and incident suggestions.</div>
          </div>
        </div>
        <button type="button" className="knowledge-wizard-exit" onClick={() => navigate(backTo)} disabled={saving}>
          <ArrowLeft size={15} /> Exit editor
        </button>
      </div>
      <div className="page-body knowledge-wizard-page">
        {loadingArticle ? <div className="spinner-row">Loading article…</div> : (
          <form className="knowledge-wizard" onSubmit={submit} noValidate>
            <ErrorBar msg={error} />
            <nav className="knowledge-wizard-steps" aria-label="Article setup steps">
              {EDITOR_STEPS.map((item, index) => (
                <button
                  type="button"
                  key={item.title}
                  className={`knowledge-wizard-step${step === index ? " current" : ""}${step > index ? " complete" : ""}`}
                  aria-current={step === index ? "step" : undefined}
                  onClick={() => { setError(""); setStep(index); }}
                >
                  <span className="knowledge-wizard-step-number">{step > index ? <Check size={14} /> : index + 1}</span>
                  <span className="knowledge-wizard-step-copy">
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  {index < EDITOR_STEPS.length - 1 && <ChevronRight className="knowledge-wizard-step-chevron" size={16} />}
                </button>
              ))}
            </nav>

            {step === 0 && (
              <div className="knowledge-wizard-columns">
                <div className="knowledge-wizard-main">
                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><FileText size={16} /></span>
                      <div><h2>Basic Information</h2><p>Identify the article and make it easy to find.</p></div>
                    </div>
                    <div className="knowledge-wizard-grid">
                      <div className="field-group">
                        <label className="lbl" htmlFor="knowledge-article-type">Article Type <span className="req">*</span></label>
                        <select id="knowledge-article-type" className="select" value={type} onChange={(e) => setType(e.target.value as ArticleType)}>
                          <option value="Standard KB">Standard KB (How-to / Troubleshooting)</option>
                          <option value="Known Error">Known Error (KEDB Workaround)</option>
                          <option value="Standard Change">Standard Change Procedure</option>
                        </select>
                      </div>
                      <Select label="Service Line / CI" value={serviceLine} onChange={setServiceLine} options={serviceLines} />
                    </div>
                    <div className="field-group">
                      <label className="lbl" htmlFor="knowledge-article-title">Article Title / Error Symptom <span className="req">*</span></label>
                      <input id="knowledge-article-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300}
                        placeholder="e.g., Error 504 Gateway Timeout during batch upload" />
                      <div className="knowledge-wizard-field-meta"><span>Use the wording users are likely to search for.</span><span>{title.length}/300</span></div>
                    </div>
                    <div className="field-group">
                      <label className="lbl" htmlFor="knowledge-article-tags">Keywords &amp; Search Tags</label>
                      <input id="knowledge-article-tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)}
                        placeholder="vpn, gateway, globalprotect, network, timeout" />
                      <div className="hint">Separate keywords with commas. These power suggestions while incidents are logged.</div>
                    </div>
                    <div className="field-group">
                      <label className="lbl" htmlFor="knowledge-summary">Summary (Abstract)</label>
                      <textarea id="knowledge-summary" className="textarea" rows={3} maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)}
                        placeholder="A short overview of the issue and the outcome this article provides." />
                      <div className="knowledge-wizard-field-meta"><span>Shown as a concise article summary.</span><span>{summary.length}/2000</span></div>
                    </div>
                  </section>

                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><UsersRound size={16} /></span>
                      <div><h2>Target Audience &amp; Visibility</h2><p>Choose who can discover and use this knowledge.</p></div>
                    </div>
                    <div className="knowledge-wizard-grid">
                      <Select label="Target User Group" value={group} onChange={setGroup} options={USER_GROUPS} />
                      <Select label="Analyst Role Restriction" value={analystRole} onChange={setAnalystRole} options={ANALYST_ROLES} />
                      <Select label="Workgroup" value={workgroup} onChange={setWorkgroup} options={workgroups} />
                      <Select label="Location Scope" value={location} onChange={setLocation} options={locations} />
                      <Select label="Department" value={department} onChange={setDepartment} options={departments} />
                    </div>
                  </section>

                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><FileText size={16} /></span>
                      <div><h2>Classification &amp; Relationship</h2><p>Connect this article to its service and related records.</p></div>
                    </div>
                    <div className="knowledge-wizard-grid">
                      <Select label="Category" value={category} onChange={setCategory} options={CATEGORIES} />
                      <Select label="Subcategory" value={subcategory} onChange={setSubcategory} options={SUBCATEGORIES} />
                      <div className="field-group">
                        <label className="lbl" htmlFor="knowledge-service">Service</label>
                        <input id="knowledge-service" className="input" value={service} onChange={(e) => setService(e.target.value)} placeholder="e.g., VPN" maxLength={120} />
                      </div>
                      <div className="field-group">
                        <label className="lbl" htmlFor="knowledge-ci">CI / Asset <span className="knowledge-wizard-optional">Optional</span></label>
                        <input id="knowledge-ci" className="input" value={configurationItem} onChange={(e) => setConfigurationItem(e.target.value)} placeholder="Search or select a CI / asset" maxLength={160} />
                      </div>
                      <div className="field-group">
                        <label className="lbl" htmlFor="knowledge-related-error">Related Known Error <span className="knowledge-wizard-optional">Optional</span></label>
                        <input id="knowledge-related-error" className="input" value={relatedArticleCode} onChange={(e) => setRelatedArticleCode(e.target.value)} placeholder="e.g., KB-10420" maxLength={20} />
                      </div>
                      {type === "Known Error" && (
                        <div className="field-group">
                          <label className="lbl" htmlFor="knowledge-problem-code">Related Problem Record <span className="knowledge-wizard-optional">Optional</span></label>
                          <input id="knowledge-problem-code" className="input" value={problemCode} onChange={(e) => setProblemCode(e.target.value)} placeholder="e.g., PRB-1042" maxLength={40} />
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><ShieldCheck size={16} /></span>
                      <div><h2>Impact &amp; Priority</h2><p>Set the expected impact and urgency; priority is calculated.</p></div>
                    </div>
                    <div className="knowledge-wizard-grid">
                      <div className="field-group">
                        <label className="lbl" htmlFor="knowledge-impact">Severity / Impact</label>
                        <select id="knowledge-impact" className="select" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                          {SEVERITIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label className="lbl" htmlFor="knowledge-urgency">Urgency</label>
                        <select id="knowledge-urgency" className="select" value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
                          {URGENCIES.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </div>
                      <div className="knowledge-priority-result"><span>Priority (Calculated)</span><strong>{priority}</strong></div>
                    </div>
                  </section>

                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><FileText size={16} /></span>
                      <div><h2>Resolution / Workaround Steps</h2><p>Write clear instructions readers can follow to resolve the issue.</p></div>
                    </div>
                    <div className="field-group">
                      <label className="lbl" htmlFor="knowledge-resolution">Resolution Steps <span className="req">*</span></label>
                      <textarea id="knowledge-resolution" className="textarea knowledge-wizard-editor-textarea" rows={9} value={resolution} onChange={(e) => setResolution(e.target.value)}
                        placeholder={"1. Verify the affected service and user scope.\n2. Follow the troubleshooting steps in order.\n3. Confirm the issue is resolved and record any follow-up."} />
                    </div>
                  </section>
                </div>

                <aside className="knowledge-wizard-aside">
                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><ShieldCheck size={16} /></span>
                      <div><h2>Article Properties</h2><p>Ownership and identification</p></div>
                    </div>
                    <div className="knowledge-wizard-property"><span>Article ID</span><strong>{editing ? `KB-${10000 + id}` : "Auto-generated"}</strong></div>
                    <div className="field-group knowledge-wizard-aside-field">
                      <label className="lbl" htmlFor="knowledge-author">Author Name</label>
                      <input id="knowledge-author" className="input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={user?.name ?? ""} maxLength={150} />
                    </div>
                    <div className="field-group knowledge-wizard-aside-field">
                      <label className="lbl" htmlFor="knowledge-owner">Owner / Maintainer</label>
                      <input id="knowledge-owner" className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Select an owner" maxLength={150} />
                    </div>
                  </section>

                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><ShieldCheck size={16} /></span>
                      <div><h2>Lifecycle &amp; Governance</h2><p>Set the article’s lifecycle and review schedule.</p></div>
                    </div>
                    <div className="knowledge-wizard-grid">
                      <div className="field-group">
                        <label className="lbl" htmlFor="knowledge-status">Article Status</label>
                        <select id="knowledge-status" className="select" value={articleStatus} onChange={(e) => setArticleStatus(e.target.value as ArticleStatus)}>
                          {ARTICLE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </div>
                      <div className="field-group">
                        <label className="lbl" htmlFor="knowledge-version">Version</label>
                        <input id="knowledge-version" className="input" value={version} onChange={(e) => setVersion(e.target.value)} maxLength={20} placeholder="v1.0" />
                      </div>
                      <div className="field-group">
                        <label className="lbl" htmlFor="knowledge-review-date">Review Date</label>
                        <input id="knowledge-review-date" className="input" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <label className="lbl" htmlFor="knowledge-expiry-date">Expiry / Retire Date</label>
                        <input id="knowledge-expiry-date" className="input" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="field-group">
                      <label className="lbl" htmlFor="knowledge-lifecycle">Knowledge Lifecycle</label>
                      <select id="knowledge-lifecycle" className="select" value={lifecycleWorkflowId ?? ""}
                        onChange={(e) => setLifecycleWorkflowId(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">{knowledgeLifecyclesLoading ? "Loading Knowledge lifecycles..." : "No lifecycle mapped"}</option>
                        {knowledgeLifecycles.map((lifecycle) => (
                          <option key={lifecycle.workflowId} value={lifecycle.workflowId} disabled={!lifecycle.isActive}>
                            {lifecycle.workflowName}{lifecycle.isActive ? "" : " (Inactive)"}
                          </option>
                        ))}
                      </select>
                      <div className="hint">
                        {knowledgeLifecyclesError
                          ? `Knowledge lifecycles could not be loaded: ${knowledgeLifecyclesError}`
                          : knowledgeLifecyclesLoading
                            ? "Loading available Knowledge lifecycles."
                            : knowledgeLifecycles.length
                              ? "Selecting a lifecycle links governance steps to this article; article status is still managed here."
                              : "Create a Knowledge lifecycle in Configuration → Knowledge Management to map it here."}
                      </div>
                    </div>
                    <div className="field-group">
                      <label className="lbl" htmlFor="knowledge-reviewers">Reviewers <span className="knowledge-wizard-optional">Optional</span></label>
                      <input id="knowledge-reviewers" className="input" value={reviewers} onChange={(e) => setReviewers(e.target.value)} placeholder="Add reviewers, separated by commas" />
                    </div>
                  </section>

                  <section className="card knowledge-wizard-card knowledge-settings-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><UsersRound size={16} /></span>
                      <div><h2>Additional Options</h2><p>Control where this article appears.</p></div>
                    </div>
                    <SettingToggle label="Enable for Self-Service Portal" checked={options.enableSelfServicePortal} onChange={(value) => updateOption("enableSelfServicePortal", value)} />
                    <SettingToggle label="Enable for Analyst Console (SKMS)" checked={options.enableAnalystConsole} onChange={(value) => updateOption("enableAnalystConsole", value)} />
                    <SettingToggle label="Mark as Featured Article" checked={options.featured} onChange={(value) => updateOption("featured", value)} />
                    <SettingToggle label="Pin to Top" checked={options.pinned} onChange={(value) => updateOption("pinned", value)} />
                    <SettingToggle label="Include in Search Index" checked={options.includeSearchIndex} onChange={(value) => updateOption("includeSearchIndex", value)} />
                    <SettingToggle label="Allow Comments / Feedback" checked={options.allowComments} onChange={(value) => updateOption("allowComments", value)} />
                    <SettingToggle label="Capture Article Usage" checked={options.captureUsage} onChange={(value) => updateOption("captureUsage", value)} />
                    <SettingToggle label="Enable Article Rating" checked={options.enableRating} onChange={(value) => updateOption("enableRating", value)} />
                  </section>

                  <section className="card knowledge-wizard-card knowledge-settings-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><Info size={16} /></span>
                      <div><h2>Advanced Settings</h2><p>Configure suggestions and article features.</p></div>
                    </div>
                    <SettingToggle label="Auto-suggest for Incident Creation" checked={options.autoSuggestIncident} onChange={(value) => updateOption("autoSuggestIncident", value)} />
                    <SettingToggle label="Enable AI Summary & Tags" checked={options.enableAiSummaryTags} onChange={(value) => updateOption("enableAiSummaryTags", value)} />
                    <SettingToggle label="Enable Similar Articles Suggestion" checked={options.enableSimilarSuggestions} onChange={(value) => updateOption("enableSimilarSuggestions", value)} />
                    <SettingToggle label="Allow Version Comparison" checked={options.allowVersionComparison} onChange={(value) => updateOption("allowVersionComparison", value)} />
                  </section>
                </aside>
              </div>
            )}

            {step === 1 && (
              <div className="knowledge-wizard-columns">
                <div className="knowledge-wizard-main">
                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><FileText size={16} /></span>
                      <div><h2>Content &amp; Solution Preview</h2><p>Review the resolution entered in Article Details.</p></div>
                    </div>
                    <div className="knowledge-wizard-preview knowledge-wizard-content-review">
                      <span className="knowledge-wizard-preview-label">{type === "Known Error" ? "WORKAROUND" : "RESOLUTION"}</span>
                      <strong>{title || "Your article title will appear here"}</strong>
                      <pre className="knowledge-wizard-review-content">{resolution || "Add resolution or workaround steps in Article Details."}</pre>
                    </div>
                    <button type="button" className="knowledge-wizard-edit-link knowledge-wizard-edit-content" onClick={() => { setError(""); setStep(0); }}>
                      Edit article details
                    </button>
                  </section>
                </div>
                <aside className="knowledge-wizard-aside">
                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><Info size={16} /></span>
                      <div><h2>Writing Guide</h2><p>Make the solution useful and easy to scan.</p></div>
                    </div>
                    <ol className="knowledge-wizard-writing-guide">
                      <li>Start with the quickest safe check.</li>
                      <li>Number each action in the order it should be performed.</li>
                      <li>Describe what success looks like after each important step.</li>
                      <li>Include escalation guidance if the workaround fails.</li>
                    </ol>
                  </section>
                  <section className="card knowledge-wizard-card knowledge-wizard-note">
                    <div className="knowledge-wizard-note-icon"><Info size={16} /></div>
                    <div><strong>Keep content actionable</strong><p>Use short numbered steps, explain how to verify the result, and include escalation guidance when needed.</p></div>
                  </section>
                </aside>
              </div>
            )}

            {step === 2 && (
              <div className="knowledge-wizard-columns">
                <div className="knowledge-wizard-main">
                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><Paperclip size={16} /></span>
                      <div><h2>Attachments &amp; Links</h2><p>Review related records and supporting material.</p></div>
                    </div>
                    <div className="knowledge-wizard-review-section">
                      <div className="knowledge-wizard-review-heading"><h3>Related Known Error</h3><button type="button" className="knowledge-wizard-edit-link" onClick={() => { setError(""); setStep(0); }}>Edit</button></div>
                      <div className="knowledge-wizard-review-meta">{relatedArticleCode.trim() || "No related Known Error"}</div>
                    </div>
                    {type === "Known Error" && <div className="knowledge-wizard-review-meta">Related Problem: {problemCode.trim() || "Not linked"}</div>}
                    <div className="knowledge-attachment-toolbar">
                      <div><strong>Supporting files</strong><span>PDF, DOCX, XLSX, TXT, PNG, JPG · up to 10 MB each</span></div>
                      <label className="btn-ghost btn-sm">
                        <Paperclip size={14} /> {uploadingAttachments ? "Working…" : "Add files"}
                        <input type="file" multiple accept=".pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg" disabled={uploadingAttachments || loadingArticle} onChange={(event) => void addAttachments(event)} />
                      </label>
                    </div>
                    <div className="knowledge-attachment-list">
                      {attachments.map((attachment) => (
                        <div className="knowledge-attachment-row" key={attachment.attachmentId}>
                          <FileText size={15} />
                          <span><strong>{attachment.fileName}</strong><small>{(attachment.sizeBytes / 1024).toFixed(0)} KB</small></span>
                          <button type="button" className="knowledge-attachment-action" aria-label={`Download ${attachment.fileName}`} onClick={() => void downloadAttachment(attachment)}><Download size={14} /></button>
                          <button type="button" className="knowledge-attachment-action" aria-label={`Remove ${attachment.fileName}`} disabled={uploadingAttachments} onClick={() => void removeAttachment(attachment)}><Trash2 size={14} /></button>
                        </div>
                      ))}
                      {queuedFiles.map((file, index) => (
                        <div className="knowledge-attachment-row queued" key={`${file.name}-${file.lastModified}-${index}`}>
                          <FileText size={15} />
                          <span><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(0)} KB · Uploads when the article is saved</small></span>
                          <button type="button" className="knowledge-attachment-action" aria-label={`Remove ${file.name}`} onClick={() => setQueuedFiles((current) => current.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
                        </div>
                      ))}
                      {attachments.length === 0 && queuedFiles.length === 0 && <div className="knowledge-attachment-empty">No supporting files attached.</div>}
                    </div>
                  </section>
                </div>
                <aside className="knowledge-wizard-aside">
                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><Info size={16} /></span>
                      <div><h2>Supporting files</h2><p>Current capability</p></div>
                    </div>
                    <p className="knowledge-wizard-aside-copy">Attach reference guides, screenshots, and supporting documents to this article. Readers with access can download the files.</p>
                  </section>
                </aside>
              </div>
            )}

            {step === 3 && (
              <div className="knowledge-wizard-columns">
                <div className="knowledge-wizard-main">
                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><UsersRound size={16} /></span>
                      <div><h2>Publishing &amp; Access</h2><p>Review who can discover and use this knowledge.</p></div>
                    </div>
                    <div className="knowledge-wizard-review-audience">{[group, analystRole, workgroup, location, department].filter(Boolean).map((value) => <span key={value}>{value}</span>)}</div>
                    <div className="knowledge-wizard-review-meta">Self-Service Portal: {options.enableSelfServicePortal ? "Enabled" : "Disabled"} · Analyst Console: {options.enableAnalystConsole ? "Enabled" : "Disabled"}</div>
                    <button type="button" className="knowledge-wizard-edit-link knowledge-wizard-edit-content" onClick={() => { setError(""); setStep(0); }}>Edit article details</button>
                  </section>
                </div>
                <aside className="knowledge-wizard-aside">
                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><ShieldCheck size={16} /></span>
                      <div><h2>Lifecycle Snapshot</h2><p>Governance details</p></div>
                    </div>
                    <div className="knowledge-wizard-property"><span>Status / version</span><strong>{articleStatus} · {version || "v1.0"}</strong></div>
                    <div className="knowledge-wizard-property"><span>Owner / maintainer</span><strong>{ownerName || "Not specified"}</strong></div>
                    <div className="knowledge-wizard-property"><span>Review date</span><strong>{reviewDate || "Not scheduled"}</strong></div>
                    <div className="knowledge-wizard-property"><span>Article ID</span><strong>{editing ? `KB-${10000 + id}` : "Assigned on publish"}</strong></div>
                    <div className="knowledge-wizard-status">
                      <span>Article Status</span>
                      <span className={`skms-pill ${articleStatus === "Published" ? "green" : "amber"}`}>{articleStatus}</span>
                    </div>
                  </section>
                  <section className="card knowledge-wizard-card knowledge-wizard-note">
                    <div className="knowledge-wizard-note-icon"><Info size={16} /></div>
                    <div><strong>Reader access</strong><p>Published articles appear in the self-service Knowledge Base when their audience settings allow it, and can be suggested during incident creation.</p></div>
                  </section>
                </aside>
              </div>
            )}

            {step === 4 && (
              <div className="knowledge-wizard-columns">
                <div className="knowledge-wizard-main">
                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><Check size={16} /></span>
                      <div><h2>Review Article</h2><p>Check the details and content before publishing.</p></div>
                    </div>
                    <div className="knowledge-wizard-review-section">
                      <div className="knowledge-wizard-review-heading"><h3>Article Details</h3><button type="button" className="knowledge-wizard-edit-link" onClick={() => { setError(""); setStep(0); }}>Edit</button></div>
                      <div className="knowledge-wizard-review-title">{title || "Untitled article"}</div>
                      <div className="knowledge-wizard-review-meta">{type}{serviceLine ? ` · ${serviceLine}` : ""} · {severity} impact · {urgency} urgency · {priority}</div>
                      {tags.trim() && <div className="knowledge-wizard-review-tags">{tags.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}</div>}
                      {(summary || category || subcategory || service || configurationItem) && (
                        <div className="knowledge-wizard-review-meta">
                          {[summary, [category, subcategory].filter(Boolean).join(" / "), service, configurationItem].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="knowledge-wizard-review-section">
                      <div className="knowledge-wizard-review-heading"><h3>Attachments &amp; Links</h3><button type="button" className="knowledge-wizard-edit-link" onClick={() => { setError(""); setStep(0); }}>Edit</button></div>
                      <div className="knowledge-wizard-review-meta">
                        {relatedArticleCode.trim() ? `Related Known Error: ${relatedArticleCode}` : "No related Known Error"}
                        {type === "Known Error" ? ` · Related Problem: ${problemCode.trim() || "Not linked"}` : ""}
                        {attachments.length + queuedFiles.length ? ` · ${attachments.length + queuedFiles.length} file${attachments.length + queuedFiles.length === 1 ? "" : "s"}` : ""}
                      </div>
                    </div>
                    <div className="knowledge-wizard-review-section">
                      <div className="knowledge-wizard-review-heading"><h3>Target Audience</h3><button type="button" className="knowledge-wizard-edit-link" onClick={() => { setError(""); setStep(0); }}>Edit</button></div>
                      <div className="knowledge-wizard-review-audience">{[group, analystRole, workgroup, location, department].filter(Boolean).map((value) => <span key={value}>{value}</span>)}</div>
                    </div>
                    <div className="knowledge-wizard-review-section">
                      <div className="knowledge-wizard-review-heading"><h3>Resolution / Workaround</h3><button type="button" className="knowledge-wizard-edit-link" onClick={() => { setError(""); setStep(0); }}>Edit</button></div>
                      <pre className="knowledge-wizard-review-content">{resolution || "No resolution steps entered."}</pre>
                    </div>
                    <div className="knowledge-wizard-review-section">
                      <div className="knowledge-wizard-review-heading"><h3>Lifecycle &amp; Governance</h3><button type="button" className="knowledge-wizard-edit-link" onClick={() => { setError(""); setStep(0); }}>Edit</button></div>
                      <div className="knowledge-wizard-review-meta">
                        {articleStatus} · {version || "v1.0"}{reviewDate ? ` · Review ${reviewDate}` : ""}{expiryDate ? ` · Expires ${expiryDate}` : ""}
                      </div>
                    </div>
                  </section>
                </div>
                <aside className="knowledge-wizard-aside">
                  <section className="card knowledge-wizard-card">
                    <div className="knowledge-wizard-card-heading">
                      <span className="knowledge-wizard-card-icon"><ShieldCheck size={16} /></span>
                      <div><h2>Ready to Save</h2><p>Final article settings</p></div>
                    </div>
                    <div className="knowledge-wizard-property"><span>Author</span><strong>{author || "Not specified"}</strong></div>
                    <div className="knowledge-wizard-property"><span>Owner / maintainer</span><strong>{ownerName || "Not specified"}</strong></div>
                    <div className="knowledge-wizard-property"><span>Access</span><strong>{options.enableSelfServicePortal ? "Portal" : ""}{options.enableSelfServicePortal && options.enableAnalystConsole ? " + " : ""}{options.enableAnalystConsole ? "Analyst Console" : ""}</strong></div>
                    <div className="knowledge-wizard-property"><span>Article ID</span><strong>{editing ? `KB-${10000 + id}` : "Assigned on save"}</strong></div>
                    <div className="knowledge-wizard-publish-note">{articleStatus === "Draft" ? "This article will be saved as a draft and won’t appear in search or the self-service portal." : "Published articles are available to eligible readers and incident suggestions."}</div>
                  </section>
                </aside>
              </div>
            )}

            <div className="knowledge-wizard-footer">
              <button type="button" className="btn-ghost" onClick={() => navigate(backTo)} disabled={saving}>Cancel</button>
              <div className="knowledge-wizard-footer-actions">
                {step > 0 && <button type="button" className="btn-ghost" onClick={() => { setError(""); setStep((current) => current - 1); }} disabled={saving}><ChevronLeft size={15} /> Back</button>}
                {step < EDITOR_STEPS.length - 1 ? (
                  <button type="button" className="btn-primary" onClick={nextStep} disabled={saving || loadingArticle}>Next: {EDITOR_STEPS[step + 1].title} <ChevronRight size={15} /></button>
                ) : (
                  <button type="submit" className="btn-primary" disabled={saving || loadingArticle || (editing && !validId)}>
                    <FilePlus2 size={14} /> {saving ? "Saving…" : submitLabel}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

export function KnowledgeArticleDetailsPage() {
  const id = Number(useRouteParams("/knowledge/articles/:id")?.id);
  const validId = Number.isInteger(id) && id > 0;
  const staff = useIsStaff();
  const staffArticle = useAsync(() => staff && validId ? knowledgeApi.article(id) : Promise.resolve(null), [staff, validId, id]);
  const portalArticle = useAsync(() => !staff && validId ? knowledgeApi.portalArticle(id) : Promise.resolve(null), [staff, validId, id]);
  const attachmentsQuery = useAsync(() => validId ? knowledgeApi.attachments(id) : Promise.resolve([]), [validId, id]);
  const article = staff ? staffArticle.data : portalArticle.data;
  const loading = staff ? staffArticle.loading : portalArticle.loading;
  const error = staff ? staffArticle.error : portalArticle.error;
  const { navigate } = useRouter();
  const [attachmentDownloadError, setAttachmentDownloadError] = useState("");
  const downloadAttachment = async (attachment: KnowledgeAttachment) => {
    setAttachmentDownloadError("");
    try {
      await knowledgeApi.downloadAttachment(id, attachment);
    } catch (e) {
      setAttachmentDownloadError(errMsg(e, "Could not download the attachment."));
    }
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-header-left">
          <div className="breadcrumb">{staff ? "Knowledge Management" : "Self-Service"} &gt; Article</div>
          <div className="page-title">{article?.title ?? "Knowledge Article"}</div>
          {article && <div className="page-subtitle">{article.articleCode}{article.serviceLine ? ` · ${article.serviceLine}` : ""}</div>}
        </div>
        <div className="skms-actions">
          <button className="btn-ghost" onClick={() => navigate(staff ? "/knowledge" : "/knowledge-base")}><ArrowLeft size={14} /> Back</button>
          {staff && validId && <Link to={`/knowledge/articles/${id}/edit`} className="btn-primary">Edit Article</Link>}
        </div>
      </div>
      <div className="page-body">
        <ErrorBar msg={error ?? ""} />
        {loading ? <div className="spinner-row">Loading article…</div> : !article ? (
          <div className="card kb-empty"><strong>We couldn’t find that article.</strong><p>{error ?? "It may have been unpublished or moved."}</p></div>
        ) : (
          <article className="card knowledge-article-detail">
            <div className="skms-asset-meta">
              <span className="skms-code">{article.articleCode}</span>
              {"articleType" in article && <span className="skms-chip">{article.articleType}</span>}
              <span className="kb-reviewed">Last reviewed {formatDate(article.lastReviewedAt)}</span>
            </div>
            <TagList tags={article.tags} />
            {staff && "severity" in article && <div className="knowledge-detail-property">Severity / Impact: <strong>{article.severity}</strong></div>}
            <h2 className="kb-steps-title">Resolution / Workaround Steps</h2>
            <pre className="skms-steps">{article.resolution}</pre>
            {(attachmentsQuery.loading || attachmentsQuery.error || (attachmentsQuery.data ?? []).length > 0) && (
              <section className="knowledge-detail-attachments">
                <h2><Paperclip size={15} /> Supporting files</h2>
                <ErrorBar msg={attachmentDownloadError} />
                {attachmentsQuery.error ? <ErrorBar msg={attachmentsQuery.error} />
                  : attachmentsQuery.loading ? <div className="knowledge-attachment-empty">Loading files…</div>
                  : (attachmentsQuery.data ?? []).map((attachment) => (
                    <button type="button" className="knowledge-detail-attachment" key={attachment.attachmentId} onClick={() => void downloadAttachment(attachment)}>
                      <FileText size={15} /><span>{attachment.fileName}</span><Download size={14} />
                    </button>
                  ))}
              </section>
            )}
          </article>
        )}
      </div>
    </>
  );
}
