import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LookupField } from "../components/LookupField";
import { lookupSourceLabel, normalizeLookupSource } from "../lookupSources";
import { api, assetUrl } from "../api";
import { ErrorBar, errMsg } from "../components/configKit";
import { type SearchOption } from "../components/SearchSelect";
import { useAuth } from "../AuthContext";
import { useAsync } from "../hooks";
import { Link, useRouter, useRouteParams } from "../router";
import { ServiceCatalogBrowser } from "./ServiceCatalogBrowser";
import { money } from "../components/serviceRequestKit";
import {
  lifecycleApi,
  requestConfigApi,
  serviceRequestApi,
  type CatalogVariable,
  type ServiceCatalog,
  type PathPreview,
} from "../requestsApi";

type FieldValue = string | string[] | boolean | File;
type DirectoryUser = { userId: number; fullName: string; email?: string; username?: string; employeeId?: string | null };
type AssignmentGroup = { groupId: number; groupName: string };

function isEmpty(value: FieldValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (value instanceof File) return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return !value;
  return !value.trim();
}

function defaultFieldValue(variable: CatalogVariable): FieldValue {
  if (variable.fieldType === "multi_select") return variable.defaultValue ? variable.defaultValue.split(",").map((v) => v.trim()).filter(Boolean) : [];
  if (variable.fieldType === "checkbox" && variable.options?.length) return variable.defaultValue ? variable.defaultValue.split(",").map((v) => v.trim()).filter(Boolean) : [];
  if (variable.fieldType === "checkbox") return ["true", "yes", "1"].includes((variable.defaultValue ?? "").toLowerCase());
  return variable.defaultValue ?? "";
}

/** "Service Catalog" — category tree + service cards (prototype page 1). */
export function ServiceRequestsPage() {
  return <ServiceCatalogBrowser />;
}

/** "Service Request Form" — opened from a catalog card via /service-requests/request/:id. */
export function ServiceRequestFormPage() {
  const params = useRouteParams("/service-requests/request/:id");
  const id = params ? Number(params.id) : NaN;
  return <RequestFormInner catalogId={Number.isFinite(id) ? id : null} />;
}

function RequestFormInner({ catalogId }: { catalogId: number | null }) {
  const { navigate } = useRouter();
  const catalogsQuery = useAsync(() => serviceRequestApi.catalogs(), []);
  const [selectedCatalogId] = useState<number | null>(catalogId);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [selectedCatalog, setSelectedCatalog] = useState<ServiceCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [values, setValues] = useState<Record<number, FieldValue>>({});
  const [lookupLabels, setLookupLabels] = useState<Record<number, string>>({});
  const [lookupError, setLookupError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [urgId, setUrgId] = useState<number | null>(null);
  const [impId, setImpId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const { user: me } = useAuth();
  const [page, setPage] = useState(0);
  const [forOther, setForOther] = useState(false);
  const [forUser, setForUser] = useState<{ id: number; name: string } | null>(null);
  const [forQuery, setForQuery] = useState("");
  const [forFound, setForFound] = useState<{ userId: number; fullName: string; email?: string }[]>([]);
  const [serverPath, setServerPath] = useState<PathPreview | null>(null);
  const [done, setDone] = useState<{ number: string; status: string } | null>(null);
  const urgenciesQuery = useAsync(() => serviceRequestApi.urgencies(), []);
  useEffect(() => { setSubmitError(""); }, [values, urgId, impId, forUser]); // stale error banner clears once fields are corrected
  const impactsQuery = useAsync(() => serviceRequestApi.serviceImpacts(), []);
  const matrixQuery = useAsync(() => requestConfigApi.matrix(), []);
  const workflowId = selectedCatalog?.workflow?.workflowId ?? null;
  const lifecycleQuery = useAsync(() => (workflowId ? lifecycleApi.get(workflowId) : Promise.resolve(null)), [workflowId]);

  const hasGroupLookup = !!selectedCatalog?.variables?.some(
    (variable) => variable.fieldType === "group_lookup" && variable.isVisible && variable.isActive,
  );
  const groupsQuery = useAsync(
    () => hasGroupLookup ? api.get<AssignmentGroup[]>("/assignment-groups") : Promise.resolve([]),
    [hasGroupLookup],
  );

  useEffect(() => {
    if (selectedCatalogId === null) {
      setSelectedCatalog(null);
      return;
    }
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError("");
    setSelectedCatalog(null);
    setValues({});
    setPage(0); setServerPath(null);
    setLookupLabels({});
    setLookupError("");
    serviceRequestApi.catalog(selectedCatalogId)
      .then((catalog) => {
        if (cancelled) return;
        setSelectedCatalog(catalog);
        // Never pre-select a high urgency/impact (users inflate priority); only a Low/Medium default is kept, otherwise the user must choose.
        setUrgId(/^(low|medium)$/i.test(catalog.urgency?.urgencyName ?? "") ? catalog.urgency!.urgencyId : null);
        setImpId(/^(low|medium)$/i.test(catalog.serviceImpact?.impactName ?? "") ? catalog.serviceImpact!.serviceImpactId : null);
        setValues(Object.fromEntries((catalog.variables ?? []).map((variable) => [variable.variableId, defaultFieldValue(variable)])));
      })
      .catch((error: unknown) => {
        if (!cancelled) setCatalogError(errMsg(error, "Unable to load this request form."));
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedCatalogId, catalogRetry]);

  const variables = useMemo(
    () => (selectedCatalog?.variables ?? [])
      .filter((variable) => variable.isActive && variable.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [selectedCatalog],
  );
  const sections = useMemo(() => {
    interface FormSection { key: string; name: string; cols: number | null; newPage: boolean; order: number; vars: CatalogVariable[] }
    const meta = new Map((selectedCatalog?.sections ?? []).map((section) => [section.sectionId, section]));
    const grouped = new Map<string, FormSection>();
    for (const variable of variables) {
      const id = variable.section?.sectionId ?? null;
      const name = variable.section?.name || variable.sectionName || "General";
      const key = id != null ? `id${id}` : `name${name}`;
      const sec = id != null ? meta.get(id) : (selectedCatalog?.sections ?? []).find((x) => x.name === name);
      const cols = /^\[cols:(\d)\]/.exec(sec?.description ?? "");
      const entry = grouped.get(key) ?? { key, name, cols: cols ? Math.min(3, Math.max(1, Number(cols[1]))) : null, newPage: /\[page\]/.test(sec?.description ?? ""), order: sec?.displayOrder ?? Number.MAX_SAFE_INTEGER, vars: [] };
      entry.vars.push(variable);
      grouped.set(key, entry);
    }
    return [...grouped.values()].sort((x, y) => x.order - y.order);
  }, [selectedCatalog, variables]);
  // A container marked "Starts a new page" begins the next page of the form.
  const pages = useMemo(() => {
    const out: (typeof sections)[] = [[]];
    sections.forEach((sec) => { if (sec.newPage && out[out.length - 1].length) out.push([]); out[out.length - 1].push(sec); });
    return out;
  }, [sections]);
  const pageIdx = Math.min(page, pages.length - 1);
  const lastPage = pageIdx === pages.length - 1;
  const pageTitle = (p: (typeof pages)[number], i: number) => (p[0]?.name && p[0].name !== "General" ? p[0].name : `Page ${i + 1}`);
  const pageMissing = (pages[pageIdx] ?? []).flatMap((sec) => sec.vars).filter((v) => v.isMandatory && v.fieldType !== "info" && isEmpty(values[v.variableId])).length;
  useEffect(() => {
    if (!forOther || forUser || forQuery.trim().length < 2) { setForFound([]); return; }
    let live = true;
    const t = setTimeout(() => { api.get<{ userId: number; fullName: string; email?: string }[]>(`/users/directory?q=${encodeURIComponent(forQuery.trim())}`).then((r) => { if (live) setForFound(r.filter((u) => String(u.userId) !== String(me?.id))); }).catch(() => { if (live) setForFound([]); }); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [forQuery, forOther, forUser, me?.id]);
  // The path follows the answers: ask the server which approvals these answers would trigger.
  const answersKey = JSON.stringify(Object.entries(values).map(([k, v]) => [k, v instanceof File ? "file" : v]));
  useEffect(() => {
    if (!selectedCatalog) return;
    let live = true;
    const t = setTimeout(() => {
      const vv = variables.flatMap((variable) => {
        const value = values[variable.variableId];
        if (value === undefined || value instanceof File || (isEmpty(value) && variable.fieldType !== "checkbox")) return [];
        return [{ variableId: variable.variableId, value: Array.isArray(value) ? value.join(", ") : lookupLabels[variable.variableId] || String(value) }];
      });
      serviceRequestApi.previewPath(selectedCatalog.catalogId, vv).then((r) => { if (live) setServerPath(r); }).catch(() => { if (live) setServerPath(null); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [selectedCatalog, answersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = (variableId: number, value: FieldValue) => {
    setValues((current) => ({ ...current, [variableId]: value }));
  };

  const searchUsers = useCallback(async (query: string): Promise<SearchOption[]> => {
    try {
      const users = await api.get<DirectoryUser[]>(`/users/directory?q=${encodeURIComponent(query.trim())}`);
      setLookupError("");
      return users.map((user) => ({
        value: user.fullName,
        label: user.fullName,
        sub: [user.email, user.username && `@${user.username}`, user.employeeId && `ID ${user.employeeId}`].filter(Boolean).join(" · "),
      }));
    } catch (error) {
      setLookupError(errMsg(error, "Unable to search the user directory."));
      return [];
    }
  }, []);

  const setLookupValue = (variableId: number, option: SearchOption | null) => {
    setValues((current) => ({ ...current, [variableId]: option?.value ?? "" }));
    setLookupLabels((current) => ({ ...current, [variableId]: option?.label ?? "" }));
  };

  const validateAttachment = (variable: CatalogVariable, file: File): string | null => {
    const maxSizeMb = Math.min(variable.maxFileSizeMb || 25, 25);
    if (file.size > maxSizeMb * 1024 * 1024) return `${variable.label} must be no larger than ${maxSizeMb} MB.`;
    const allowedExtensions = (variable.allowedFileTypes ?? "")
      .split(",")
      .map((extension) => extension.trim().toLowerCase())
      .filter((extension) => extension.startsWith("."));
    if (allowedExtensions.length && !allowedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension))) {
      return `${variable.label} must be one of these file types: ${allowedExtensions.join(", ")}.`;
    }
    return null;
  };

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCatalog) return;
    setSubmitError("");
    setLookupError("");

    const submissionVariables = (selectedCatalog.variables ?? []).filter(
      (variable) => (variable.fieldType !== "info" || variable.isMandatory) && ((variable.isVisible && variable.isActive) || variable.isMandatory),
    );
    const requiredFields = submissionVariables.filter((variable) => variable.isMandatory);
    const missing = requiredFields.filter((variable) => isEmpty(values[variable.variableId]));
    if (missing.length) {
      const hiddenRequired = missing.filter((variable) => !variable.isVisible || !variable.isActive || variable.readOnly || variable.fieldType === "info");
      if (hiddenRequired.length) {
        setSubmitError(`This service is missing a default value for required field${hiddenRequired.length === 1 ? "" : "s"}: ${hiddenRequired.map((variable) => variable.label).join(", ")}. Please contact your service desk.`);
        return;
      }
      setSubmitError(`Please complete the required field${missing.length === 1 ? "" : "s"}: ${missing.map((variable) => variable.label).join(", ")}.`);
      return;
    }

    const attachmentVariables = submissionVariables.filter(
      (variable) => variable.fieldType === "attachment" && values[variable.variableId] instanceof File,
    );
    for (const variable of attachmentVariables) {
      const file = values[variable.variableId];
      if (file instanceof File) {
        const error = validateAttachment(variable, file);
        if (error) {
          setSubmitError(error);
          return;
        }
      }
    }

    if (!urgId || !impId) { setSubmitError("Select Urgency and Impact before submitting."); return; }
    setSubmitting(true);
    try {
      const uploaded = new Map<number, string>();
      await Promise.all(attachmentVariables.map(async (variable) => {
        const file = values[variable.variableId];
        if (file instanceof File) {
          const response = await serviceRequestApi.upload(file);
          uploaded.set(variable.variableId, response.url);
        }
      }));

      const variableValues = submissionVariables
        .flatMap((variable) => {
          const value = values[variable.variableId];
          if (value === undefined || isEmpty(value) && variable.fieldType !== "checkbox") return [];
          const storedValue = uploaded.get(variable.variableId)
            ?? (value instanceof File ? "" : Array.isArray(value) ? value.join(", ") : lookupLabels[variable.variableId] || String(value));
          return [{ variableId: variable.variableId, value: storedValue }];
        });
      if (forOther && !forUser) { setSubmitError("Choose who this request is for, or switch back to Myself."); setSubmitting(false); return; }
      const created = await serviceRequestApi.create({
        catalogId: selectedCatalog.catalogId, variableValues, ...(forOther && forUser ? { requestedForUserId: forUser.id } : {}),
        ...(urgId ? { urgencyId: urgId } : {}), ...(impId ? { serviceImpactId: impId } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setDone({ number: created.requestNumber || `#${created.requestId}`, status: created.status });
    } catch (error) {
      setSubmitError(errMsg(error, "Unable to submit your service request."));
    } finally {
      setSubmitting(false);
    }
  };

  const renderVariable = (variable: CatalogVariable) => {
    const value = values[variable.variableId];
    const inputId = `request-variable-${variable.variableId}`;
    const required = variable.isMandatory;
    const disabled = variable.readOnly;
    const help = variable.helpText || variable.tooltipText;
    const options = [...(variable.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    let control: React.ReactNode;

    switch (variable.fieldType) {
      case "info":
        control = <div className="service-request-info">{variable.defaultValue || variable.helpText || variable.label}</div>;
        break;
      case "textarea":
        control = <textarea id={inputId} className="textarea" maxLength={variable.maxLength ?? undefined} required={required} disabled={disabled} placeholder={variable.placeholder ?? ""} value={typeof value === "string" ? value : ""} onChange={(event) => setValue(variable.variableId, event.target.value)} />;
        break;
      case "dropdown":
        control = (
          <select id={inputId} className="select" required={required} disabled={disabled} value={typeof value === "string" ? value : ""} onChange={(event) => setValue(variable.variableId, event.target.value)}>
            <option value="">Select…</option>
            {options.map((option) => <option key={option.optionId} value={option.optionValue}>{option.optionLabel}</option>)}
          </select>
        );
        break;
      case "multi_select":
        control = (
          <select id={inputId} className="select service-request-multi-select" required={required} disabled={disabled} multiple value={Array.isArray(value) ? value : []} onChange={(event) => setValue(variable.variableId, Array.from(event.target.selectedOptions, (option) => option.value))}>
            {options.map((option) => <option key={option.optionId} value={option.optionValue}>{option.optionLabel}</option>)}
          </select>
        );
        break;
      case "radio":
        control = (
          <div className="service-request-options">
            {options.map((option) => (
              <label key={option.optionId} className="service-request-choice">
                <input type="radio" name={inputId} required={required} disabled={disabled} checked={value === option.optionValue} onChange={() => setValue(variable.variableId, option.optionValue)} />
                {option.optionLabel}
              </label>
            ))}
          </div>
        );
        break;
      case "checkbox":
        if (options.length) {
          const checked = Array.isArray(value) ? value : typeof value === "string" ? value.split(",").filter(Boolean) : [];
          control = (
            <div className="service-request-options">
              {options.map((option) => (
                <label key={option.optionId} className="service-request-choice">
                  <input type="checkbox" disabled={disabled} checked={checked.includes(option.optionValue)} onChange={() => setValue(variable.variableId, checked.includes(option.optionValue) ? checked.filter((item) => item !== option.optionValue) : [...checked, option.optionValue])} />
                  {option.optionLabel}
                </label>
              ))}
            </div>
          );
        } else {
          control = (
            <label className="service-request-choice">
              <input id={inputId} type="checkbox" required={required} disabled={disabled} checked={value === true} onChange={(event) => setValue(variable.variableId, event.target.checked)} />
              {variable.placeholder || variable.label}
            </label>
          );
        }
        break;
      case "attachment": {
        const file = value instanceof File ? value : null;
        control = (
          <>
            <input id={inputId} className="input service-request-file" type="file" required={required} disabled={disabled} accept={variable.allowedFileTypes || undefined} onChange={(event) => setValue(variable.variableId, event.target.files?.[0] ?? "")} />
            {file && <span className="service-request-help">{file.name}</span>}
          </>
        );
        break;
      }
      case "user_lookup":
      case "group_lookup": {
        const isUser = variable.fieldType === "user_lookup";
        const source = isUser ? "users" : normalizeLookupSource(variable.lookupSource);
        control = (
          <LookupField
            source={source}
            value={typeof value === "string" ? value : ""}
            label={lookupLabels[variable.variableId] ?? (typeof value === "string" ? value : "")}
            fetchOverride={source === "users" ? searchUsers : undefined}
            onSelect={(option) => setLookupValue(variable.variableId, option)}
            placeholder={variable.placeholder || (isUser ? "Search people (User table)…" : `Search ${lookupSourceLabel(source).toLowerCase()}…`)}
            disabled={disabled}
            ariaLabel={variable.label}
          />
        );
        break;
      }
      case "number":
      case "date":
      case "datetime":
      case "text":
      default: {
        const type = variable.fieldType === "number" ? "number" : variable.fieldType === "date" ? "date" : variable.fieldType === "datetime" ? "datetime-local" : "text";
        control = (
          <input
            id={inputId}
            className="input"
            type={type}
            required={required}
            disabled={disabled}
            placeholder={variable.placeholder ?? ""}
            maxLength={type === "text" ? variable.maxLength ?? undefined : undefined}
            min={type === "number" ? variable.minValue ?? undefined : type === "date" && variable.noPastDates ? new Date().toISOString().slice(0, 10) : variable.dateMin ?? undefined}
            max={type === "number" ? variable.maxValue ?? undefined : variable.dateMax ?? undefined}
            step={type === "number" ? variable.onlyIntegers ? 1 : "any" : undefined}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => setValue(variable.variableId, event.target.value)}
          />
        );
      }
    }

    return (
      <div className={`service-request-field ${variable.fieldType === "info" ? "service-request-field-wide" : ""}`} key={variable.variableId}>
        {variable.fieldType !== "info" && (
          <label className="lbl" htmlFor={inputId}>
            {variable.label}{required && <span className="req"> *</span>}
          </label>
        )}
        {control}
        {help && variable.fieldType !== "info" && <span className="service-request-help">{help}</span>}
      </div>
    );
  };

  const urgOptions = urgenciesQuery.data ?? [];
  const impOptions = impactsQuery.data ?? [];
  const urgName = urgOptions.find((u) => u.urgencyId === urgId)?.urgencyName;
  const impName = impOptions.find((x) => x.serviceImpactId === impId)?.impactName;
  const priorityName = selectedCatalog?.priority?.priorityName
    ?? (urgId && impId
      ? (matrixQuery.data ?? []).find((m) => m.isActive && m.urgencyId === urgId && m.serviceImpactId === impId)?.priority.priorityName
      : undefined);
  const days = Number(selectedCatalog?.deliveryTimeSla ?? selectedCatalog?.estimatedTime) || 0;
  const catPath = selectedCatalog?.serviceCategory?.categoryName || selectedCatalog?.category?.categoryName || "Uncategorised";
  const catalogItems = (catalogsQuery.data ?? []).filter((c) => (c.status ?? "published").toLowerCase() !== "draft" && c.isActive !== false);
  const approvalSteps = (lifecycleQuery.data?.steps ?? []).filter((st) => st.stepType === "approval").sort((a, b) => a.stepOrder - b.stepOrder);
  const needsApproval = !!selectedCatalog?.approvalRequired;
  const path: { title: string; sub: string }[] = [];
  if (needsApproval) {
    const levels = approvalSteps.flatMap((st) => (st.approvalLevels ?? []).filter((l) => !l.autoApproval).map((l) => l.title || st.stepName));
    (levels.length ? levels : approvalSteps.map((st) => st.stepName)).forEach((t) => path.push({ title: t, sub: "Approval" }));
    if (!path.length) path.push({ title: selectedCatalog?.workflow?.workflowName ?? "Approval", sub: "Approval" });
  }
  path.push({ title: selectedCatalog?.fulfillmentGroup?.groupName || selectedCatalog?.assignmentGroup?.groupName || "Fulfilment team", sub: days ? `Fulfilled within ${days} business ${days > 1 ? "days" : "day"}` : "Fulfilment" });
  path.push({ title: "Closed", sub: "You confirm the service was delivered" });
  if (serverPath) {
    path.length = 0;
    serverPath.approvals.forEach((a) => path.push({ title: a.title, sub: `Approval by ${a.approver}${a.rule ? ` \u00b7 ${a.rule}` : ""}` }));
    const dd = serverPath.deliveryDays;
    path.push({ title: serverPath.fulfilmentGroup || "Fulfilment team", sub: dd ? `Fulfilled within ${dd} business ${dd > 1 ? "days" : "day"}` : "Fulfilment" });
    path.push({ title: "Closed", sub: "You confirm the service was delivered" });
  }
  const hint = (txt?: string | null) => (txt ? <div className="sc-hint">{txt}</div> : null);

  if (done) {
    const pending = done.status === "Pending Approval";
    return (
      <div className="sc-page">
        <div className="sc-body" style={{ justifyContent: "center", paddingTop: 48 }}>
          <div className="sc-panel sc-done">
            <div className="sc-done-icon" aria-hidden="true">✓</div>
            <div className="sc-done-title">Request {done.number} submitted</div>
            <div className="sc-done-text">{pending ? "It is waiting for approval. You will be notified as soon as it is approved or rejected." : "No approval is needed, so it has gone straight to the fulfilment team."}</div>
            <div className="sc-done-actions">
              <Link to="/service-requests/my-requests" className="sc-btn primary">Track this request</Link>
              {pending
                ? <Link to="/service-requests/approvals" className="sc-btn">Open the approver view</Link>
                : <Link to="/service-requests/queue" className="sc-btn">Open the fulfilment queue</Link>}
              <Link to="/service-requests" className="sc-btn">Back to catalog</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const img = selectedCatalog?.bannerUrl || selectedCatalog?.iconUrl;
  return (
    <div className="sc-page">
      <div className="sc-head">
        <div className="sc-crumb">User &gt; <Link to="/service-requests">Service Catalog</Link> &gt; <span>{selectedCatalog?.catalogName ?? "…"}</span></div>
        <div className="sc-head-row">
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {img && <span aria-hidden="true" className="sc-thumb" style={{ backgroundImage: `url("${assetUrl(img)}")` }} />}
            <div>
              <h1>Request: {selectedCatalog?.catalogName ?? ""}</h1>
              <div className="sc-sub">{selectedCatalog?.shortDescription || selectedCatalog?.description || "Complete the details below to submit your request."}</div>
            </div>
          </div>
          <Link to="/service-requests" className="sc-btn">Cancel</Link>
        </div>
      </div>

      <div className="sc-body">
        {submitError && <div style={{ flex: "1 1 100%" }}><ErrorBar msg={submitError} /></div>}
        {catalogLoading && <div className="spinner-row" style={{ flex: "1 1 100%" }}>Loading request form…</div>}
        {catalogError && (
          <div style={{ flex: "1 1 100%" }}>
            <ErrorBar msg={catalogError} />
            <button type="button" className="sc-btn" onClick={() => setCatalogRetry((n) => n + 1)} disabled={catalogLoading}>Try again</button>
          </div>
        )}
        {selectedCatalog && !catalogLoading && (
          <form className="sc-form-wrap" onSubmit={(event) => void submitRequest(event)}>
            <div className="sc-panel sc-form-main service-request-form-content">
              {lookupError && <ErrorBar msg={lookupError} />}
              {groupsQuery.error && hasGroupLookup && <ErrorBar msg={groupsQuery.error} />}
              {pages.length > 1 && (
                <div className="rf-pages" aria-label="Form pages">
                  {pages.map((pg, i) => <span key={i} className={`rf-page-pill ${i === pageIdx ? "active" : ""}`} aria-current={i === pageIdx ? "step" : undefined}>{i + 1}. {pageTitle(pg, i)}</span>)}
                </div>
              )}
              {(pages[pageIdx] ?? []).map((sec) => (
                <fieldset className="service-request-form-section" key={sec.key}>
                  {sections.length > 1 && <legend>{sec.name}</legend>}
                  <div className={`service-request-fields ${sec.cols ? "cols" : selectedCatalog.formLayout === "two-column" ? "two-column" : ""}`} style={sec.cols ? ({ "--cols": sec.cols } as React.CSSProperties) : undefined}>
                    {sec.vars.map(renderVariable)}
                  </div>
                </fieldset>
              ))}
              {lastPage && (<>
              <div className="service-request-field">
                <label className="lbl" htmlFor="rf-for">Requested for</label>
                <select id="rf-for" className="select" value={forOther ? "other" : "me"} onChange={(e) => { const other = e.target.value === "other"; setForOther(other); if (!other) { setForUser(null); setForQuery(""); } }}>
                  <option value="me">Myself{me?.name ? ` (${me.name})` : ""}</option>
                  <option value="other">Someone else</option>
                </select>
                {forOther && (forUser
                  ? <div className="sr-members"><span className="sr-member">{forUser.name}<button type="button" aria-label="Clear person" onClick={() => setForUser(null)}>x</button></span></div>
                  : <div style={{ position: "relative" }}>
                    <input className="input" placeholder="Search people by name or e-mail..." aria-label="Search people" value={forQuery} onChange={(e) => setForQuery(e.target.value)} />
                    {forFound.length > 0 && <div className="sr-suggest">{forFound.map((u) => <button key={u.userId} type="button" onClick={() => { setForUser({ id: u.userId, name: u.fullName }); setForQuery(""); setForFound([]); }}>{u.fullName}{u.email ? ` \u00b7 ${u.email}` : ""}</button>)}</div>}
                  </div>)}
                {hint(forOther ? "They become the requester and get the updates. You are recorded as the person who submitted it." : null)}
              </div>
              <div className="service-request-field">
                <label className="lbl" htmlFor="rf-urg">Urgency</label>
                <select id="rf-urg" className="select" value={urgId ?? ""} onChange={(e) => setUrgId(e.target.value ? Number(e.target.value) : null)}>
                  {!urgId && <option value="">Select…</option>}
                  {urgOptions.map((u) => <option key={u.urgencyId} value={u.urgencyId}>{u.urgencyName}</option>)}
                </select>
                {hint("How soon you need this. It sets the delivery priority together with impact.")}
              </div>
              <div className="service-request-field">
                <label className="lbl" htmlFor="rf-imp">Impact</label>
                <select id="rf-imp" className="select" value={impId ?? ""} onChange={(e) => setImpId(e.target.value ? Number(e.target.value) : null)}>
                  {!impId && <option value="">Select…</option>}
                  {impOptions.map((x) => <option key={x.serviceImpactId} value={x.serviceImpactId}>{x.impactName}</option>)}
                </select>
                {hint("How many people or how much work is affected if this is not delivered.")}
              </div>
              <div className="service-request-field">
                <label className="lbl" htmlFor="rf-notes">Additional notes (optional)</label>
                <textarea id="rf-notes" className="textarea" maxLength={2000} placeholder="Anything else the approver or fulfilment team should know…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              </>)}
              {pages.length > 1 && (
                <div className="rf-page-nav">
                  <button type="button" className="sc-btn" disabled={pageIdx === 0} onClick={() => setPage(Math.max(0, pageIdx - 1))}>Back</button>
                  <span className="sc-hint">{lastPage ? "Last page. Submit from the summary panel." : pageMissing > 0 ? "Complete the required fields to continue." : "Continue to the next page."}</span>
                  <button type="button" className="sc-btn primary" disabled={lastPage || pageMissing > 0} onClick={() => setPage(Math.min(pages.length - 1, pageIdx + 1))}>Next</button>
                </div>
              )}
            </div>

            <div className="sc-side">
              <div className="sc-panel sc-sidepanel">
                <div className="sc-eyebrow">Request summary</div>
                <label className="lbl" htmlFor="rf-item" style={{ marginTop: 10 }}>Service</label>
                <select id="rf-item" className="select" value={selectedCatalogId ?? ""} disabled={submitting} onChange={(e) => navigate(`/service-requests/request/${e.target.value}`)}>
                  {catalogItems.map((c) => <option key={c.catalogId} value={c.catalogId}>{c.catalogName}</option>)}
                </select>
                <div className="sc-kv"><span>Category</span><b>{catPath}</b></div>
                {forOther && forUser && <div className="sc-kv"><span>Requested for</span><b>{forUser.name}</b></div>}
                <div className="sc-kv"><span>Est. cost</span><b>{selectedCatalog.hidePrice ? "—" : Number(selectedCatalog.estimatedCost) ? money(selectedCatalog.estimatedCost) : "No cost"}</b></div>
                <div className="sc-kv"><span>Delivery target</span><b>{days ? `${days} business ${days > 1 ? "days" : "day"}` : "—"}</b></div>
                <div className="sc-kv"><span>Priority</span>{priorityName ? <span className="pill blue">{priorityName}</span> : <b>—</b>}</div>
                <div className="sc-hint">{urgName && impName ? `Set from ${urgName} urgency and ${impName} impact.` : "Choose urgency and impact to see the priority."}</div>
              </div>

              <div className="sc-panel sc-sidepanel">
                <div className="sc-eyebrow">What happens next</div>
                {serverPath && <div className="sc-hint" style={{ marginBottom: 6 }}>This path depends on your answers and updates as you fill in the form.</div>}
                <ol className="sc-path">
                  {path.map((st, i) => (
                    <li key={i}><span className="sc-num">{i + 1}</span><div><div className="sc-path-title">{st.title}</div><div className="sc-hint" style={{ marginTop: 1 }}>{st.sub}</div></div></li>
                  ))}
                </ol>
              </div>

              <button type="submit" className="sc-btn primary" style={{ width: "100%", height: 40 }} disabled={submitting || groupsQuery.loading || !lastPage}>
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
