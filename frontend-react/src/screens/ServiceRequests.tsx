import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Search, ShoppingCart } from "lucide-react";
import { api } from "../api";
import { ErrorBar, errMsg } from "../components/configKit";
import { SearchSelect, type SearchOption } from "../components/SearchSelect";
import { useAsync } from "../hooks";
import { Link } from "../router";
import {
  serviceRequestApi,
  type CatalogVariable,
  type ServiceCatalog,
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

export function ServiceRequestsPage() {
  const catalogsQuery = useAsync(() => serviceRequestApi.catalogs(), []);
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [selectedCatalog, setSelectedCatalog] = useState<ServiceCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [values, setValues] = useState<Record<number, FieldValue>>({});
  const [lookupLabels, setLookupLabels] = useState<Record<number, string>>({});
  const [lookupError, setLookupError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSort, setCatalogSort] = useState<"popular" | "name" | "recent">("popular");
  const [submitting, setSubmitting] = useState(false);

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
    setLookupLabels({});
    setLookupError("");
    serviceRequestApi.catalog(selectedCatalogId)
      .then((catalog) => {
        if (cancelled) return;
        setSelectedCatalog(catalog);
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
    const grouped = new Map<string, CatalogVariable[]>();
    for (const variable of variables) {
      const name = variable.section?.name || variable.sectionName || "General";
      grouped.set(name, [...(grouped.get(name) ?? []), variable]);
    }
    const order = new Map((selectedCatalog?.sections ?? []).map((section) => [section.name, section.displayOrder]));
    return [...grouped.entries()].sort(([a], [b]) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER));
  }, [selectedCatalog, variables]);
  const groups = groupsQuery.data ?? [];
  const catalogs = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    const filtered = (catalogsQuery.data ?? []).filter((catalog) =>
      !query || [
        catalog.catalogName,
        catalog.shortDescription ?? "",
        catalog.description ?? "",
        catalog.category?.categoryName ?? "",
        catalog.serviceCategory?.categoryName ?? "",
      ].some((field) => field.toLowerCase().includes(query)),
    );
    return filtered.sort((a, b) => catalogSort === "recent"
      ? (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      : catalogSort === "name"
        ? a.catalogName.localeCompare(b.catalogName)
        : Number(b.showInPopular) - Number(a.showInPopular) || a.catalogName.localeCompare(b.catalogName));
  }, [catalogSearch, catalogSort, catalogsQuery.data]);

  const setValue = (variableId: number, value: FieldValue) => {
    setValues((current) => ({ ...current, [variableId]: value }));
  };

  const searchUsers = useCallback(async (query: string): Promise<SearchOption[]> => {
    try {
      const users = await api.get<DirectoryUser[]>(`/users/directory?q=${encodeURIComponent(query.trim())}`);
      setLookupError("");
      return users.map((user) => ({
        value: String(user.userId),
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
    setNotice("");
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
      const created = await serviceRequestApi.create({ catalogId: selectedCatalog.catalogId, variableValues });
      setNotice(`Request #${created.requestId} has been submitted.`);
      setSelectedCatalogId(null);
      setSelectedCatalog(null);
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
        control = <textarea id={inputId} className="textarea" required={required} disabled={disabled} placeholder={variable.placeholder ?? ""} value={typeof value === "string" ? value : ""} onChange={(event) => setValue(variable.variableId, event.target.value)} />;
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
        const groupOptions = groups.map((group) => ({ value: String(group.groupId), label: group.groupName }));
        control = (
          <SearchSelect
            value={typeof value === "string" ? value : ""}
            label={lookupLabels[variable.variableId] ?? (typeof value === "string" ? value : "")}
            fetchOptions={isUser ? searchUsers : undefined}
            options={isUser ? undefined : groupOptions}
            onSelect={(option) => setLookupValue(variable.variableId, option)}
            placeholder={variable.lookupSource || variable.placeholder || (isUser ? "Search users…" : "Search groups…")}
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
            min={type === "number" ? variable.minValue ?? undefined : variable.dateMin ?? undefined}
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

  return (
    <div className="service-requests-page">
      <header className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">Self Service</div>
          <div className="page-title">Service Requests</div>
          <div className="page-subtitle">Browse the service catalog and submit a request.</div>
        </div>
        <Link to="/service-requests/my-requests" className="btn-ghost" style={{ whiteSpace: "nowrap" }}>My Requests</Link>
      </header>

      <div className="page-body service-requests-body">
        {notice && <div className="service-request-notice" role="status">{notice}</div>}
        {submitError && <ErrorBar msg={submitError} />}

        <section className="card service-request-section">
          <div className="service-request-section-heading">
            <div>
              <h2><ShoppingCart size={18} aria-hidden="true" /> {selectedCatalog ? "Submit a Request" : "Browse Services"}</h2>
              <p>{selectedCatalog ? "Complete the required details below." : "Select a catalog item to get started."}</p>
            </div>
            {selectedCatalog && (
              <button type="button" className="btn-ghost" onClick={() => setSelectedCatalogId(null)} disabled={submitting}>
                <ArrowLeft size={15} /> Back to catalog
              </button>
            )}
          </div>

          {catalogsQuery.loading && !catalogsQuery.data && <div className="spinner-row">Loading services…</div>}
          {catalogsQuery.error && <><ErrorBar msg={catalogsQuery.error} /><button type="button" className="btn-ghost" onClick={catalogsQuery.reload}>Retry loading services</button></>}
          {!selectedCatalogId && catalogsQuery.data && catalogsQuery.data.length === 0 && (
            <div className="empty-state">There are no service catalog items available right now.</div>
          )}
          {!selectedCatalogId && catalogsQuery.data && catalogsQuery.data.length > 0 && (
            <div className="service-request-catalog-browser">
              <div className="service-request-catalog-filters">
                <label className="service-request-search">
                  <Search size={15} aria-hidden="true" />
                  <input aria-label="Search service catalog" placeholder="Search services…" value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} />
                </label>
                <select className="select" aria-label="Sort services" value={catalogSort} onChange={(event) => setCatalogSort(event.target.value as typeof catalogSort)}>
                  <option value="popular">Sort by: Popular</option>
                  <option value="name">Sort by: Name A–Z</option>
                  <option value="recent">Sort by: Recently added</option>
                </select>
              </div>
              {catalogs.length === 0 ? <div className="empty-state">No matching services found.</div> : (
                <div className="service-request-catalog-grid">
                  {catalogs.map((catalog) => (
                    <button
                      type="button"
                      className="service-request-catalog-card"
                      key={catalog.catalogId}
                      onClick={() => { setNotice(""); setSubmitError(""); setSelectedCatalogId(catalog.catalogId); }}
                      style={catalog.tileColor ? { borderTopColor: catalog.tileColor } : undefined}
                    >
                      <span className="service-request-catalog-icon"><ShoppingCart size={18} aria-hidden="true" /></span>
                      <strong>{catalog.catalogName}</strong>
                      <span>{catalog.shortDescription || catalog.description || "Open this service request form."}</span>
                      <small>{catalog.serviceCategory?.categoryName || catalog.category?.categoryName || "Uncategorized"}</small>
                      {catalog.estimatedTime != null && <small><Clock3 size={13} aria-hidden="true" /> Estimated {catalog.estimatedTime} minutes</small>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedCatalogId !== null && catalogLoading && <div className="spinner-row">Loading request form…</div>}
          {selectedCatalogId !== null && catalogError && (
            <div className="service-request-form-content">
              <ErrorBar msg={catalogError} />
              <button type="button" className="btn-ghost" onClick={() => setCatalogRetry((attempt) => attempt + 1)} disabled={catalogLoading}>Try again</button>
            </div>
          )}
          {selectedCatalog && !catalogLoading && (
            <form className="service-request-form-content" onSubmit={(event) => void submitRequest(event)}>
              <div className="service-request-catalog-title">
                <h3>{selectedCatalog.catalogName}</h3>
                {selectedCatalog.description && <p>{selectedCatalog.description}</p>}
              </div>
              {lookupError && <ErrorBar msg={lookupError} />}
              {groupsQuery.error && hasGroupLookup && <ErrorBar msg={groupsQuery.error} />}
              {sections.map(([name, sectionVariables]) => (
                <fieldset className="service-request-form-section" key={name}>
                  <legend>{name}</legend>
                  <div className={`service-request-fields ${selectedCatalog.formLayout === "two-column" ? "two-column" : ""}`}>
                    {sectionVariables.map(renderVariable)}
                  </div>
                </fieldset>
              ))}
              <div className="service-request-form-actions">
                <button type="button" className="btn-ghost" onClick={() => setSelectedCatalogId(null)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting || groupsQuery.loading}>
                  {submitting ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          )}
        </section>

      </div>
    </div>
  );
}
