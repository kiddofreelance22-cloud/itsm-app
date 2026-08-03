"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CatalogVariable } from "@/types/catalog";
import { cn } from "@/lib/utils";

interface DynamicFormProps {
  variables: CatalogVariable[];
  isSubmitting?: boolean;
  onSubmit: (values: Record<number, string>) => void;
  onCancel?: () => void;
}

export function DynamicForm({
  variables,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: DynamicFormProps) {
  const sorted = [...variables]
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(sorted.map((v) => [v.variableId, v.defaultValue ?? ""]))
  );
  const [errors, setErrors] = useState<Record<number, string>>({});

  const set = (id: number, val: string) => {
    setValues((prev) => ({ ...prev, [id]: val }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<number, string> = {};
    for (const v of sorted) {
      if (v.isMandatory && !values[v.variableId]?.trim()) {
        newErrors[v.variableId] = `${v.label} is required`;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {sorted.map((v) => (
        <div key={v.variableId} className="space-y-1.5">
          <Label htmlFor={`field-${v.variableId}`}>
            {v.label}
            {v.isMandatory && <span className="text-red-500 ml-0.5">*</span>}
          </Label>

          {/* text */}
          {v.fieldType === "text" && (
            <Input
              id={`field-${v.variableId}`}
              value={values[v.variableId] ?? ""}
              onChange={(e) => set(v.variableId, e.target.value)}
              placeholder={v.defaultValue ?? ""}
            />
          )}

          {/* textarea */}
          {v.fieldType === "textarea" && (
            <Textarea
              id={`field-${v.variableId}`}
              value={values[v.variableId] ?? ""}
              onChange={(e) => set(v.variableId, e.target.value)}
              rows={3}
              placeholder={v.defaultValue ?? ""}
            />
          )}

          {/* number */}
          {v.fieldType === "number" && (
            <Input
              id={`field-${v.variableId}`}
              type="number"
              value={values[v.variableId] ?? ""}
              onChange={(e) => set(v.variableId, e.target.value)}
            />
          )}

          {/* date */}
          {v.fieldType === "date" && (
            <Input
              id={`field-${v.variableId}`}
              type="date"
              value={values[v.variableId] ?? ""}
              onChange={(e) => set(v.variableId, e.target.value)}
            />
          )}

          {/* dropdown */}
          {v.fieldType === "dropdown" && (
            <select
              id={`field-${v.variableId}`}
              value={values[v.variableId] ?? ""}
              onChange={(e) => set(v.variableId, e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select --</option>
              {v.options
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((opt) => (
                  <option key={opt.optionId} value={opt.optionValue}>
                    {opt.optionLabel}
                  </option>
                ))}
            </select>
          )}

          {/* radio */}
          {v.fieldType === "radio" && (
            <div className="space-y-1.5">
              {v.options
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((opt) => (
                  <label key={opt.optionId} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`field-${v.variableId}`}
                      value={opt.optionValue}
                      checked={values[v.variableId] === opt.optionValue}
                      onChange={() => set(v.variableId, opt.optionValue)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">{opt.optionLabel}</span>
                  </label>
                ))}
            </div>
          )}

          {/* checkbox (multi-select, comma-joined) */}
          {v.fieldType === "checkbox" && (
            <div className="space-y-1.5">
              {v.options
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((opt) => {
                  const current = values[v.variableId]
                    ? values[v.variableId].split(",").map((s) => s.trim())
                    : [];
                  const checked = current.includes(opt.optionValue);
                  return (
                    <label key={opt.optionId} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value={opt.optionValue}
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? current.filter((x) => x !== opt.optionValue)
                            : [...current, opt.optionValue];
                          set(v.variableId, next.join(","));
                        }}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">{opt.optionLabel}</span>
                    </label>
                  );
                })}
            </div>
          )}

          {errors[v.variableId] && (
            <p className="text-xs text-red-500">{errors[v.variableId]}</p>
          )}
        </div>
      ))}

      {sorted.length === 0 && (
        <p className="text-sm text-gray-500">No form fields configured for this catalog item.</p>
      )}

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting && <Spinner size="sm" />}
          Submit Request
        </Button>
      </div>
    </form>
  );
}
