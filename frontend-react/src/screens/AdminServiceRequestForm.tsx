import { LookupField } from "../components/LookupField";
import { lookupSourceLabel, normalizeLookupSource } from "../lookupSources";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { ErrorBar, errMsg } from "../components/configKit";
import { SearchSelect, type SearchOption } from "../components/SearchSelect";
import { useAsync } from "../hooks";
import { Link, useRouteParams, useRouter } from "../router";
import {
  serviceRequestApi,
  type CatalogVariable,
  type ServiceCatalog,
} from "../requestsApi";

interface DirectoryUser {
  userId: number;
  fullName: string;
  email?: string;
  username?: string;
  employeeId?: string | null;
}
interface AssignmentGroup { groupId: number; groupName: string }

const defaultValue = (variable: CatalogVariable): string => variable.defaultValue ?? "";
const requestNumber = (id: number) => `REQ${String(id).padStart(8, "0")}`;

export function AdminServiceRequestForm({ editing = false }: { editing?: boolean }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const route = useRouteParams("/admin/edit-service-request/:id");
  const requestId = editing && route ? Number(route.id) : 0;
  const catalogsQuery = useAsync(() => serviceRequestApi.catalogs(), []);
  const requestQuery = useAsync(() => requestId ? serviceRequestApi.get(requestId) : Promise.resolve(null), [requestId]);
  const [catalogId, setCatalogId] = useState<number | null>(null);
  const catalogQuery = useAsync(() => catalogId ? serviceRequestApi.catalog(catalogId) : Promise.resolve(null), [catalogId]);
  const [formValues, setFormValues] = useState<Record<number, string>>({});
  const [requester, setRequester] = useState<SearchOption | null>(null);
  const [editReason, setEditReason] = useState("");
  const [initializingEdit, setInitializingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [initializedCatalog, setInitializedCatalog] = useState<number | null>(null);

  const catalog = catalogQuery.data as ServiceCatalog | null;
  const request = requestQuery.data;
  const groupsQuery = useAsync(
    () => catalog?.variables?.some((variable) => variable.fieldType === "group_lookup" && variable.isActive && variable.isVisible)
      ? api.get<AssignmentGroup[]>("/assignment-groups")
      : Promise.resolve([]),
    [catalog],
  );

  useEffect(() => {
    if (!editing || !request) return;
    setCatalogId(request.catalog.catalogId ?? null);
    setRequester(request.requestedBy?.userId
      ? { value: String(request.requestedBy.userId), label: request.requestedBy.fullName ?? "" }
      : null);
    setInitializingEdit(true);
  }, [editing, request]);

  useEffect(() => {
    if (!catalog || !catalogId || initializedCatalog === catalogId) return;
    if (editing && initializingEdit && request && request.catalog.catalogId === catalogId) {
      const answers = new Map((request.variableValues ?? []).map((answer) => [answer.variable.variableId, answer.value]));
      setFormValues(Object.fromEntries((catalog.variables ?? []).map((variable) => [
        variable.variableId,
        answers.get(variable.variableId) ?? defaultValue(variable),
      ])));
      setInitializingEdit(false);
    } else if (!editing) {
      setFormValues(Object.fromEntries((catalog.variables ?? []).map((variable) => [variable.variableId, defaultValue(variable)])));
    }
    setInitializedCatalog(catalogId);
  }, [catalog, catalogId, editing, initializedCatalog, initializingEdit, request]);

  const visibleVariables = useMemo(() => (catalog?.variables ?? [])
    .filter((variable) => variable.isActive && variable.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder), [catalog]);
  const sectionGroups = useMemo(() => {
    const groupsByName = new Map<string, CatalogVariable[]>();
    for (const variable of visibleVariables) {
      const name = variable.section?.name || variable.sectionName || "General";
      groupsByName.set(name, [...(groupsByName.get(name) ?? []), variable]);
    }
    const order = new Map((catalog?.sections ?? []).map((section) => [section.name, section.displayOrder]));
    return [...groupsByName.entries()].sort(([a], [b]) =>
      (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER));
  }, [catalog, visibleVariables]);
  const readOnlyStatus = !!request && request.status !== "Submitted";

  const searchUsers = useCallback(async (query: string): Promise<SearchOption[]> => {
    const rows = await api.get<DirectoryUser[]>(`/users/directory?q=${encodeURIComponent(query.trim())}`);
    return rows.map((entry) => ({
      value: String(entry.userId),
      label: entry.fullName,
      sub: [entry.email, entry.username && `@${entry.username}`, entry.employeeId && `ID ${entry.employeeId}`].filter(Boolean).join(" · "),
    }));
  }, []);

  const setValue = (variableId: number, value: string) => {
    setFormValues((previous) => ({ ...previous, [variableId]: value }));
  };

  const uploadVariableFile = async (variable: CatalogVariable, file?: File) => {
    if (!file || !catalog) return;
    if (variable.maxFileSizeMb && file.size > variable.maxFileSizeMb * 1024 * 1024) {
      setFormError(`${variable.label} must be smaller than ${variable.maxFileSizeMb} MB.`);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const uploaded = await serviceRequestApi.upload(file);
      setValue(variable.variableId, uploaded.url);
    } catch (error) {
      setFormError(errMsg(error, `Unable to upload ${file.name}.`));
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!catalog) return;
    if (editing && request && request.status !== "Submitted") {
      setFormError("Only requests that are still Submitted can be edited. Requests in workflow must be left unchanged.");
      return;
    }
    if (!editing && !requester) {
      setFormError("Choose the user who submitted this request.");
      return;
    }

    const allVariables = (catalog.variables ?? []).filter((variable) => variable.fieldType !== "info");
    const missing = allVariables.filter((variable) => variable.isMandatory && !String(formValues[variable.variableId] ?? "").trim());
    if (missing.length) {
      setFormError(`Complete the required field${missing.length === 1 ? "" : "s"}: ${missing.map((variable) => variable.label).join(", ")}.`);
      return;
    }

    const variableValues = allVariables.flatMap((variable) => {
      const value = formValues[variable.variableId] ?? "";
      return value.trim() || variable.isMandatory
        ? [{ variableId: variable.variableId, value }]
        : [];
    });
    setSaving(true);
    try {
      const body = { variableValues, ...(editReason.trim() ? { comments: editReason.trim() } : {}) };
      const saved = editing
        ? await serviceRequestApi.update(requestId, body)
        : await serviceRequestApi.createForUser(Number(requester?.value), { catalogId: catalog.catalogId, variableValues });
      navigate(`/admin/requests/${saved.requestId}`);
    } catch (error) {
      setFormError(errMsg(error, editing ? "Unable to update this request." : "Unable to create this request."));
    } finally {
      setSaving(false);
    }
  };

  const renderField = (variable: CatalogVariable) => {
    const value = formValues[variable.variableId] ?? "";
    const fieldId = `admin-request-${variable.variableId}`;
    const options = [...(variable.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const set = (next: string) => setValue(variable.variableId, next);
    let field: React.ReactNode;
    switch (variable.fieldType) {
      case "info":
        field = <div className="service-request-info">{variable.defaultValue || variable.helpText || variable.label}</div>;
        break;
      case "textarea":
        field = <textarea id={fieldId} className="textarea" required={variable.isMandatory} disabled={variable.readOnly || readOnlyStatus} value={value} placeholder={variable.placeholder ?? ""} onChange={(event) => set(event.target.value)} />;
        break;
      case "dropdown":
        field = <select id={fieldId} className="select" required={variable.isMandatory} disabled={variable.readOnly || readOnlyStatus} value={value} onChange={(event) => set(event.target.value)}><option value="">Select…</option>{options.map((option) => <option key={option.optionId} value={option.optionValue}>{option.optionLabel}</option>)}</select>;
        break;
      case "multi_select":
        field = <select id={fieldId} className="select service-request-multi-select" multiple required={variable.isMandatory} disabled={variable.readOnly || readOnlyStatus} value={value ? value.split(",").map((entry) => entry.trim()) : []} onChange={(event) => set(Array.from(event.target.selectedOptions, (option) => option.value).join(", "))}>{options.map((option) => <option key={option.optionId} value={option.optionValue}>{option.optionLabel}</option>)}</select>;
        break;
      case "checkbox":
        if (options.length) {
          const selected = value.split(",").map((entry) => entry.trim()).filter(Boolean);
          field = <div className="service-request-options">{options.map((option) => <label key={option.optionId} className="service-request-choice"><input type="checkbox" disabled={variable.readOnly || readOnlyStatus} checked={selected.includes(option.optionValue)} onChange={() => set(selected.includes(option.optionValue) ? selected.filter((entry) => entry !== option.optionValue).join(", ") : [...selected, option.optionValue].join(", "))} />{option.optionLabel}</label>)}</div>;
        } else {
          field = <label className="service-request-choice"><input type="checkbox" disabled={variable.readOnly || readOnlyStatus} checked={value === "true"} onChange={(event) => set(String(event.target.checked))} />{variable.placeholder || variable.label}</label>;
        }
        break;
      case "radio":
        field = <div className="service-request-options">{options.map((option) => <label key={option.optionId} className="service-request-choice"><input type="radio" name={fieldId} required={variable.isMandatory} disabled={variable.readOnly || readOnlyStatus} checked={value === option.optionValue} onChange={() => set(option.optionValue)} />{option.optionLabel}</label>)}</div>;
        break;
      case "attachment":
        field = <><input id={fieldId} className="input service-request-file" type="file" disabled={variable.readOnly || readOnlyStatus || saving} accept={variable.allowedFileTypes ?? undefined} onChange={(event) => void uploadVariableFile(variable, event.target.files?.[0])} />{value && <span className="service-request-help">{value.split("/").pop()}</span>}</>;
        break;
      case "user_lookup":
      case "group_lookup": {
        const isUser = variable.fieldType === "user_lookup";
        const source = isUser ? "users" : normalizeLookupSource(variable.lookupSource);
        field = <LookupField source={source} value={value} label={value} fetchOverride={source === "users" ? searchUsers : undefined} onSelect={(option) => set(option?.label ?? "")} placeholder={variable.placeholder || (isUser ? "Search people (User table)…" : `Search ${lookupSourceLabel(source).toLowerCase()}…`)} disabled={variable.readOnly || readOnlyStatus} ariaLabel={variable.label} />;
        break;
      }
      case "number":
      case "date":
      case "datetime":
      case "text":
      default: {
        const type = variable.fieldType === "number" ? "number" : variable.fieldType === "date" ? "date" : variable.fieldType === "datetime" ? "datetime-local" : "text";
        field = <input id={fieldId} className="input" type={type} required={variable.isMandatory} disabled={variable.readOnly || readOnlyStatus} value={value} placeholder={variable.placeholder ?? ""} min={type === "number" ? variable.minValue ?? undefined : variable.dateMin ?? undefined} max={type === "number" ? variable.maxValue ?? undefined : variable.dateMax ?? undefined} step={type === "number" ? variable.onlyIntegers ? 1 : "any" : undefined} onChange={(event) => set(event.target.value)} />;
      }
    }
    return <div className={`service-request-field ${variable.fieldType === "info" ? "service-request-field-wide" : ""}`} key={variable.variableId}>{variable.fieldType !== "info" && <label className="lbl" htmlFor={fieldId}>{variable.label}{variable.isMandatory && <span className="req"> *</span>}</label>}{field}{variable.helpText && variable.fieldType !== "info" && <span className="service-request-help">{variable.helpText}</span>}</div>;
  };

  if (user?.role !== "ADMIN") return <div className="page-body"><ErrorBar msg="You don’t have permission to manage requests." /></div>;
  if (editing && requestQuery.loading) return <div className="spinner-row">Loading request…</div>;
  if (editing && (requestQuery.error || !request)) return <div className="page-body"><ErrorBar msg={requestQuery.error || "Request not found."} /><Link to="/admin/requests" className="btn-ghost">Back to requests</Link></div>;

  return (
    <div className="service-requests-page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb"><Link to="/admin/requests">Service Requests</Link> / {editing ? "Edit" : "Create"}</div>
          <div className="page-title">{editing ? `Edit ${requestNumber(requestId)}` : "Create Service Request"}</div>
          <div className="page-subtitle">{editing ? "Only requests that have not entered a workflow can be edited." : "Submit a service request on behalf of a user."}</div>
        </div>
        <Link className="btn-ghost service-request-nav-button" to={editing ? `/admin/requests/${requestId}` : "/admin/requests"}><ArrowLeft size={14} /> Cancel</Link>
      </header>
      <div className="page-body service-requests-body">
        {formError && <ErrorBar msg={formError} />}
        {!editing && catalogsQuery.error && <ErrorBar msg={catalogsQuery.error} />}
        {!editing && (
          <section className="card service-request-section">
            <label className="service-request-field"><span className="lbl">Requested user <span className="req">*</span></span><SearchSelect value={requester?.value ?? ""} label={requester?.label ?? ""} fetchOptions={searchUsers} onSelect={setRequester} placeholder="Search for a user…" ariaLabel="Requested user" /></label>
          </section>
        )}
        <section className="card service-request-section">
          <label className="service-request-field"><span className="lbl">Catalog item <span className="req">*</span></span><select className="select" value={catalogId ?? ""} disabled={editing || catalogsQuery.loading || !!request} onChange={(event) => { const next = event.target.value ? Number(event.target.value) : null; setCatalogId(next); setInitializedCatalog(null); setFormValues({}); }}><option value="">Choose a service…</option>{(catalogsQuery.data ?? []).map((item) => <option key={item.catalogId} value={item.catalogId}>{item.catalogName}</option>)}</select></label>
        </section>
        {catalogQuery.error && <ErrorBar msg={catalogQuery.error} />}
        {catalogQuery.loading && catalogId && <div className="spinner-row">Loading request form…</div>}
        {catalog && !catalogQuery.loading && (
          <form className="service-request-form-content" onSubmit={(event) => void submit(event)}>
            {sectionGroups.map(([name, fields]) => <fieldset className="service-request-form-section" key={name}><legend>{name}</legend><div className={`service-request-fields ${catalog.formLayout === "two-column" ? "two-column" : ""}`}>{fields.map(renderField)}</div></fieldset>)}
            {editing && <label className="service-request-field"><span className="lbl">Change reason (optional)</span><textarea className="textarea" value={editReason} onChange={(event) => setEditReason(event.target.value)} /></label>}
            {groupsQuery.error && <ErrorBar msg={groupsQuery.error} />}
            {readOnlyStatus && <ErrorBar msg={`This request is ${request?.status} and cannot be edited.`} />}
            <div className="service-request-form-actions"><button className="btn-primary" type="submit" disabled={saving || readOnlyStatus || groupsQuery.loading}><Save size={14} /> {saving ? "Saving…" : editing ? "Save request changes" : "Create service request"}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}
