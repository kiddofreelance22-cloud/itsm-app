"use client";
import { useState } from "react";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { VariableOptionList } from "./variable-option-list";
import { CatalogVariable, FieldType } from "@/types/catalog";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox (multi)" },
  { value: "radio", label: "Radio" },
];

const NEEDS_OPTIONS: FieldType[] = ["dropdown", "checkbox", "radio"];

interface NewVar {
  label: string;
  fieldType: FieldType;
  isMandatory: boolean;
  defaultValue: string;
  options: { optionLabel: string; optionValue: string }[];
}

interface VariableBuilderProps {
  catalogId: number;
  variables: CatalogVariable[];
  onCreateVar: (body: {
    label: string;
    fieldType: string;
    isMandatory: boolean;
    defaultValue?: string;
    sortOrder: number;
    options?: { optionLabel: string; optionValue: string }[];
  }) => Promise<CatalogVariable | null>;
  onUpdateVar: (
    vid: number,
    body: { label?: string; isMandatory?: boolean; isActive?: boolean }
  ) => Promise<boolean>;
  onRemoveVar: (vid: number) => Promise<boolean>;
}

const emptyNew = (): NewVar => ({
  label: "",
  fieldType: "text",
  isMandatory: false,
  defaultValue: "",
  options: [],
});

export function VariableBuilder({
  variables,
  onCreateVar,
  onUpdateVar,
  onRemoveVar,
}: VariableBuilderProps) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newVar, setNewVar] = useState<NewVar>(emptyNew());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const sorted = [...variables].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleAdd = async () => {
    if (!newVar.label.trim()) return;
    setSaving(true);
    const result = await onCreateVar({
      label: newVar.label,
      fieldType: newVar.fieldType,
      isMandatory: newVar.isMandatory,
      defaultValue: newVar.defaultValue || undefined,
      sortOrder: variables.length,
      options: NEEDS_OPTIONS.includes(newVar.fieldType) ? newVar.options : undefined,
    });
    setSaving(false);
    if (result) {
      setAdding(false);
      setNewVar(emptyNew());
    }
  };

  const handleToggleActive = async (v: CatalogVariable) => {
    await onUpdateVar(v.variableId, { isActive: !v.isActive });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Form Fields</h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1 h-8">
            <Plus className="h-3.5 w-3.5" /> Add Field
          </Button>
        )}
      </div>

      {/* Existing variables */}
      {sorted.length === 0 && !adding && (
        <p className="text-sm text-gray-400 text-center py-6 border rounded-lg border-dashed">
          No form fields yet. Click &quot;Add Field&quot; to create the first one.
        </p>
      )}

      <div className="space-y-2">
        {sorted.map((v) => (
          <div
            key={v.variableId}
            className={`rounded-lg border bg-white ${!v.isActive ? "opacity-50" : ""}`}
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <GripVertical className="h-4 w-4 text-gray-300 shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800">{v.label}</span>
                <span className="ml-2 text-xs text-gray-400">
                  ({FIELD_TYPES.find((f) => f.value === v.fieldType)?.label ?? v.fieldType})
                </span>
                {v.isMandatory && (
                  <span className="ml-2 text-xs text-red-500">Required</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    setExpandedId(expandedId === v.variableId ? null : v.variableId)
                  }
                  className="text-gray-400 hover:text-gray-600"
                >
                  {expandedId === v.variableId ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleToggleActive(v)}
                  className="text-xs text-gray-400 hover:text-blue-500"
                >
                  {v.isActive ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => onRemoveVar(v.variableId)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Inline edit options preview */}
            {expandedId === v.variableId && NEEDS_OPTIONS.includes(v.fieldType) && (
              <div className="px-4 pb-3 pt-1 border-t">
                <p className="text-xs text-gray-500 mb-2">Options:</p>
                {(v.options ?? []).length === 0 ? (
                  <p className="text-xs text-gray-400">No options defined.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {(v.options ?? []).map((o) => (
                      <span
                        key={o.optionId}
                        className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-0.5"
                      >
                        {o.optionLabel}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new field form */}
      {adding && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-700">New Field</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Label *</Label>
              <Input
                autoFocus
                value={newVar.label}
                onChange={(e) => setNewVar((p) => ({ ...p, label: e.target.value }))}
                placeholder="e.g. Laptop Model"
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Field Type</Label>
              <select
                value={newVar.fieldType}
                onChange={(e) =>
                  setNewVar((p) => ({
                    ...p,
                    fieldType: e.target.value as FieldType,
                    options: [],
                  }))
                }
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FIELD_TYPES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mandatory"
              checked={newVar.isMandatory}
              onChange={(e) => setNewVar((p) => ({ ...p, isMandatory: e.target.checked }))}
              className="accent-blue-600"
            />
            <label htmlFor="mandatory" className="text-sm text-gray-700 cursor-pointer">
              Required field
            </label>
          </div>

          {NEEDS_OPTIONS.includes(newVar.fieldType) && (
            <VariableOptionList
              options={[]}
              onChange={(opts) => setNewVar((p) => ({ ...p, options: opts }))}
            />
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAdding(false);
                setNewVar(emptyNew());
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={saving || !newVar.label.trim()}
              className="gap-2"
            >
              {saving && <Spinner size="sm" />}
              Add Field
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
