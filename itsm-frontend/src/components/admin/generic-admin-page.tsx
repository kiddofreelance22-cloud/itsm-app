"use client";

import { useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, Column } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

type FormValue = string | number | boolean | null | undefined;
type AdminFormData = Record<string, FormValue>;

function normalizeFormValue(value: unknown): FormValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : "";
}

function buildInitialForm(fields: FieldDef[]): AdminFormData {
  return fields.reduce<AdminFormData>((acc, field) => {
    acc[field.key] = field.type === "checkbox" ? true : "";
    return acc;
  }, {});
}

function buildFormFromItem<T extends object>(item: T, fields: FieldDef[]): AdminFormData {
  return fields.reduce<AdminFormData>((acc, field) => {
    const value = item[field.key as keyof T];
    acc[field.key] = normalizeFormValue(value);
    return acc;
  }, {});
}

interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select" | "search" | "checkbox" | "number";
  options?: string[] | { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
}

interface GenericAdminPageProps<T extends object> {
  title: string;
  description: string;
  breadcrumbs: { label: string; href?: string }[];
  idKey: keyof T;
  nameKey: keyof T;
  codeKey?: keyof T;
  items: T[];
  isLoading: boolean;
  columns: Column<T>[];
  fields: FieldDef[];
  searchKeys: (keyof T)[];
  singularLabel: string;
  onCreate: (data: AdminFormData) => Promise<boolean>;
  onUpdate: (id: number, data: AdminFormData) => Promise<boolean>;
  onRemove: (id: number) => Promise<boolean>;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function GenericAdminPage<T extends object>({
  title, description, breadcrumbs, idKey, nameKey, codeKey,
  items, isLoading, columns, fields, searchKeys, singularLabel,
  onCreate, onUpdate, onRemove,
}: GenericAdminPageProps<T>) {
  const [dialog, setDialog] = useState(false);
  const [editItem, setEditItem] = useState<T | null>(null);
  const [deleteItem, setDeleteItem] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AdminFormData>({});

  const openCreate = () => {
    setEditItem(null);
    setForm(buildInitialForm(fields));
    setDialog(true);
  };

  const openEdit = (item: T) => {
    setEditItem(item);
    setForm(buildFormFromItem(item, fields));
    setDialog(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = editItem
      ? await onUpdate(editItem[idKey] as number, form)
      : await onCreate(form);
    setSaving(false);
    if (ok) setDialog(false);
  };

  const allColumns: Column<T>[] = [
    ...columns,
    {
      key: "isActive", label: "Status",
      render: (row) => <StatusBadge active={Boolean((row as Record<string, unknown>).isActive)} />,
    },
    {
      key: "_actions", label: "",
      render: (row) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={() => setDeleteItem(row)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <Breadcrumb items={breadcrumbs} />
      <PageHeader title={title} description={description}
        action={
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="size-4" /> New {singularLabel}
          </Button>
        }
      />
      <DataTable
        columns={allColumns} data={items} isLoading={isLoading}
        rowKey={(row) => row[idKey] as number}
        searchKeys={searchKeys as (keyof T)[]}
        searchPlaceholder={`Search ${title.toLowerCase()}...`}
        emptyText={`No ${title.toLowerCase()} found.`}
      />

      <Dialog open={dialog} onOpenChange={(v) => !v && setDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? `Edit ${singularLabel}` : `Create ${singularLabel}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}{f.required !== false && " *"}</Label>
                {f.type === "textarea" ? (
                  <Textarea rows={2} value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} />
                ) : f.type === "select" ? (
                  <select value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select —</option>
                    {f.options?.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === "search" ? (
                  <>
                    <Input list={`${f.key}-options`} value={String(form[f.key] ?? "")}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} required={f.required !== false} />
                    <datalist id={`${f.key}-options`}>
                      {f.options?.map((o) => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.label} />)}
                    </datalist>
                  </>
                ) : f.type === "checkbox" ? (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(form[f.key])}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.checked }))}
                      className="accent-blue-600" />
                    <span className="text-sm text-gray-600">{f.placeholder ?? f.label}</span>
                  </div>
                ) : f.type === "number" ? (
                  <Input type="number" value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
                    placeholder={f.placeholder} />
                ) : (
                  <Input value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required={f.required !== false} />
                )}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Spinner size="sm" />}
                {editItem ? "Save Changes" : `Create ${singularLabel}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteItem}
        title={`Delete "${deleteItem?.[nameKey]}"?`}
        description="This action cannot be undone."
        confirmLabel="Delete" variant="danger"
        onConfirm={async () => {
          if (deleteItem) { await onRemove(deleteItem[idKey] as number); setDeleteItem(null); }
        }}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
}
