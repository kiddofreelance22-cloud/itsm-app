"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CatalogVariable } from "@/types/catalog";

interface CatalogVariableFieldProps {
  variable: CatalogVariable;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

/**
 * Renders a single catalog variable as a form control.
 *
 * Only handles the field types the backend can actually produce today
 * (text, textarea, number, date, dropdown, radio, checkbox). The
 * CatalogVariable type also declares datetime/multi_select/attachment/
 * user_lookup/group_lookup/info, but nothing in the catalog editor or
 * API can create those yet, so there's no real data to render them for.
 */
export function CatalogVariableField({ variable: v, value, error, onChange }: CatalogVariableFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`field-${v.variableId}`}>
        {v.label}
        {v.isMandatory && <span className="text-red-500 ml-0.5">*</span>}
      </Label>

      {v.fieldType === "text" && (
        <Input
          id={`field-${v.variableId}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={v.defaultValue ?? ""}
        />
      )}

      {v.fieldType === "textarea" && (
        <Textarea
          id={`field-${v.variableId}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={v.defaultValue ?? ""}
        />
      )}

      {v.fieldType === "number" && (
        <Input
          id={`field-${v.variableId}`}
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {v.fieldType === "date" && (
        <Input
          id={`field-${v.variableId}`}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {v.fieldType === "dropdown" && (
        <select
          id={`field-${v.variableId}`}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select --</option>
          {[...v.options]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((opt) => (
              <option key={opt.optionId} value={opt.optionValue}>
                {opt.optionLabel}
              </option>
            ))}
        </select>
      )}

      {v.fieldType === "radio" && (
        <div className="space-y-1.5">
          {[...v.options]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((opt) => (
              <label key={opt.optionId} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`field-${v.variableId}`}
                  value={opt.optionValue}
                  checked={value === opt.optionValue}
                  onChange={() => onChange(opt.optionValue)}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-700">{opt.optionLabel}</span>
              </label>
            ))}
        </div>
      )}

      {v.fieldType === "checkbox" && (
        <div className="space-y-1.5">
          {[...v.options]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((opt) => {
              const current = value ? value.split(",").map((s) => s.trim()) : [];
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
                      onChange(next.join(","));
                    }}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{opt.optionLabel}</span>
                </label>
              );
            })}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
