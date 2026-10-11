"use client";

import { useState, useEffect, useRef } from "react";
import { Paperclip, Loader2, X, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CatalogVariable } from "@/types/catalog";
import { apiFetch } from "@/lib/api/client";
import { uploadFile } from "@/lib/api/uploads.api";

interface CatalogVariableFieldProps {
  variable: CatalogVariable;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

interface DirectoryEntry { userId?: number; groupId?: number; fullName?: string; groupName?: string; email?: string }

/** Debounced search against /users/directory or /assignment-groups, shared by user_lookup and group_lookup below. */
function useDirectorySearch(kind: "user" | "group", query: string) {
  const [results, setResults] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      const path = kind === "user" ? `/users/directory?q=${encodeURIComponent(query)}` : `/assignment-groups`;
      apiFetch<DirectoryEntry[]>(path)
        .then((rows) => {
          if (cancelled) return;
          const filtered = kind === "group" && query
            ? rows.filter((r) => r.groupName?.toLowerCase().includes(query.toLowerCase()))
            : rows;
          setResults(filtered.slice(0, 25));
        })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [kind, query]);
  return { results, loading };
}

function LookupField({ variable: v, value, onChange, kind }: { variable: CatalogVariable; value: string; onChange: (v: string) => void; kind: "user" | "group" }) {
  const [query, setQuery] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const { results, loading } = useDirectorySearch(kind, query);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      <Input
        id={`field-${v.variableId}`}
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={v.placeholder ?? (kind === "user" ? "Search for a person…" : "Search for a group…")}
        disabled={v.readOnly}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-56 overflow-auto">
          {loading && <p className="px-3 py-2 text-xs text-gray-400 flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Searching…</p>}
          {!loading && results.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No matches</p>}
          {!loading && results.map((r) => {
            const label = kind === "user" ? r.fullName : r.groupName;
            return (
              <button key={r.userId ?? r.groupId} type="button"
                onClick={() => { onChange(label ?? ""); setQuery(label ?? ""); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                {label}{kind === "user" && r.email ? <span className="text-gray-400 text-xs ml-1.5">{r.email}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttachmentField({ variable: v, value, onChange }: { variable: CatalogVariable; value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileName = value ? value.split("/").pop() : "";

  const handleFile = async (file: File) => {
    if (v.maxFileSizeMb && file.size > v.maxFileSizeMb * 1024 * 1024) {
      alert(`File exceeds the ${v.maxFileSizeMb}MB limit for this field.`);
      return;
    }
    setUploading(true);
    try {
      const result = await uploadFile(file);
      onChange(result.url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
          <Paperclip className="size-3.5 text-gray-400" />
          <span className="flex-1 truncate">{fileName}</span>
          <button type="button" onClick={() => onChange("")} className="text-gray-400 hover:text-red-500"><X className="size-3.5" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-60">
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
          {uploading ? "Uploading…" : "Attach a file"}
        </button>
      )}
      {v.allowedFileTypes && <p className="text-xs text-gray-400 mt-1">Allowed: {v.allowedFileTypes}{v.maxFileSizeMb ? ` · up to ${v.maxFileSizeMb}MB` : ""}</p>}
      <input ref={inputRef} type="file" className="hidden" accept={v.allowedFileTypes ?? undefined}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

/**
 * Renders a single catalog variable as a form control. Shared by the
 * requester-facing request form and the "Preview Catalog Item" action in
 * the admin editor, so a field built in the Variables tab looks and behaves
 * the same place either way.
 */
export function CatalogVariableField({ variable: v, value, error, onChange }: CatalogVariableFieldProps) {
  if (v.fieldType === "info") {
    return (
      <div className="flex gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
        <Info className="size-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{v.label}</p>
          {v.helpText && <p className="text-blue-700/80 text-xs mt-0.5">{v.helpText}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`field-${v.variableId}`}>
        {v.label}
        {v.isMandatory && <span className="text-red-500 ml-0.5">*</span>}
      </Label>

      {v.fieldType === "text" && (
        <Input id={`field-${v.variableId}`} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          placeholder={v.placeholder ?? v.defaultValue ?? ""} disabled={v.readOnly} />
      )}

      {v.fieldType === "textarea" && (
        <Textarea id={`field-${v.variableId}`} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          rows={3} placeholder={v.placeholder ?? v.defaultValue ?? ""} disabled={v.readOnly} />
      )}

      {v.fieldType === "number" && (
        <Input id={`field-${v.variableId}`} type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          min={v.minValue ?? undefined} max={v.maxValue ?? undefined} disabled={v.readOnly} />
      )}

      {v.fieldType === "date" && (
        <Input id={`field-${v.variableId}`} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          min={v.dateMin ?? undefined} max={v.dateMax ?? undefined} disabled={v.readOnly} />
      )}

      {v.fieldType === "datetime" && (
        <Input id={`field-${v.variableId}`} type="datetime-local" value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          min={v.dateMin ?? undefined} max={v.dateMax ?? undefined} disabled={v.readOnly} />
      )}

      {v.fieldType === "dropdown" && (
        <select id={`field-${v.variableId}`} value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={v.readOnly}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">-- Select --</option>
          {[...(v.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((opt) => (
            <option key={opt.optionId} value={opt.optionValue}>{opt.optionLabel}</option>
          ))}
        </select>
      )}

      {v.fieldType === "multi_select" && (
        <select multiple id={`field-${v.variableId}`} disabled={v.readOnly}
          value={value ? value.split(",").map((s) => s.trim()) : []}
          onChange={(e) => onChange(Array.from(e.target.selectedOptions).map((o: HTMLOptionElement) => o.value).join(","))}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24">
          {[...(v.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((opt) => (
            <option key={opt.optionId} value={opt.optionValue}>{opt.optionLabel}</option>
          ))}
        </select>
      )}

      {v.fieldType === "radio" && (
        <div className="space-y-1.5">
          {[...(v.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((opt) => (
            <label key={opt.optionId} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name={`field-${v.variableId}`} value={opt.optionValue}
                checked={value === opt.optionValue} onChange={() => onChange(opt.optionValue)}
                disabled={v.readOnly} className="accent-blue-600" />
              <span className="text-sm text-gray-700">{opt.optionLabel}</span>
            </label>
          ))}
        </div>
      )}

      {v.fieldType === "checkbox" && (
        <div className="space-y-1.5">
          {[...(v.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map((opt) => {
            const current = value ? value.split(",").map((s) => s.trim()) : [];
            const checked = current.includes(opt.optionValue);
            return (
              <label key={opt.optionId} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" value={opt.optionValue} checked={checked} disabled={v.readOnly}
                  onChange={() => {
                    const next = checked ? current.filter((x) => x !== opt.optionValue) : [...current, opt.optionValue];
                    onChange(next.join(","));
                  }}
                  className="accent-blue-600" />
                <span className="text-sm text-gray-700">{opt.optionLabel}</span>
              </label>
            );
          })}
        </div>
      )}

      {v.fieldType === "attachment" && <AttachmentField variable={v} value={value ?? ""} onChange={onChange} />}
      {v.fieldType === "user_lookup" && <LookupField variable={v} value={value ?? ""} onChange={onChange} kind="user" />}
      {v.fieldType === "group_lookup" && <LookupField variable={v} value={value ?? ""} onChange={onChange} kind="group" />}

      {v.helpText && <p className="text-xs text-gray-400">{v.helpText}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
