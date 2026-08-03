"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CatalogVariableOption } from "@/types/catalog";

interface VariableOptionListProps {
  options: CatalogVariableOption[];
  onChange: (options: { optionLabel: string; optionValue: string }[]) => void;
}

export function VariableOptionList({ options, onChange }: VariableOptionListProps) {
  const [draft, setDraft] = useState<{ optionLabel: string; optionValue: string }[]>(
    options.map((o) => ({ optionLabel: o.optionLabel, optionValue: o.optionValue }))
  );

  const update = (
    idx: number,
    key: "optionLabel" | "optionValue",
    value: string
  ) => {
    const next = draft.map((o, i) => (i === idx ? { ...o, [key]: value } : o));
    setDraft(next);
    onChange(next);
  };

  const add = () => {
    const next = [...draft, { optionLabel: "", optionValue: "" }];
    setDraft(next);
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = draft.filter((_, i) => i !== idx);
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="space-y-2 pl-4 border-l-2 border-blue-100">
      <p className="text-xs text-gray-500 font-medium">Options</p>
      {draft.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            placeholder="Label"
            value={opt.optionLabel}
            onChange={(e) => update(idx, "optionLabel", e.target.value)}
            className="h-8 text-sm"
          />
          <Input
            placeholder="Value"
            value={opt.optionValue}
            onChange={(e) => update(idx, "optionValue", e.target.value)}
            className="h-8 text-sm"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="shrink-0 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="h-7 text-xs gap-1">
        <Plus className="h-3 w-3" /> Add Option
      </Button>
    </div>
  );
}
