"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export function MultiSelectDropdown({
  options, selected, onChange, placeholder = "Select...", disabled, invalid,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          "w-full min-h-10 rounded-lg border bg-white text-sm text-left pl-3 pr-8 py-2",
          "outline-none shadow-sm transition-all relative",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
          "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed",
          invalid ? "border-red-400" : "border-slate-300",
        ].join(" ")}
      >
        {selectedLabels.length === 0 ? (
          <span className="text-slate-400">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {selectedLabels.map((l) => (
              <span key={l} className="inline-flex items-center rounded-md bg-brand-50 text-brand-700 text-xs px-1.5 py-0.5">
                {l}
              </span>
            ))}
          </span>
        )}
        <ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-slate-400" />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1">
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-400">No options available</div>
          )}
          {options.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => toggle(o.value)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors"
              >
                <span className={[
                  "flex items-center justify-center size-4 rounded border shrink-0",
                  checked ? "bg-brand-600 border-brand-600" : "border-slate-300",
                ].join(" ")}>
                  {checked && <Check className="size-3 text-white" strokeWidth={3} />}
                </span>
                <span className="flex-1 text-slate-800">{o.label}</span>
                {o.sublabel && <span className="text-xs text-slate-400">{o.sublabel}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
