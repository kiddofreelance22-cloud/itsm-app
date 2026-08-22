"use client";

import { useState } from "react";
import { Check, Clock, Timer, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { CatalogVariableField } from "@/components/requests/catalog-variable-field";
import { cn } from "@/lib/utils";
import type { Catalog } from "@/types/catalog";

export interface RequestedFor {
  mode: "self" | "other";
  name: string;
}

interface RequestWizardProps {
  catalog: Catalog;
  isSubmitting?: boolean;
  onSubmit: (values: Record<number, string>, requestedFor: RequestedFor) => void;
  onCancel?: () => void;
}

const STEPS = ["Request Details", "Additional Information", "Review & Confirm"] as const;

export function RequestWizard({ catalog, isSubmitting = false, onSubmit, onCancel }: RequestWizardProps) {
  const allVariables = [...catalog.variables]
    .filter((v) => v.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // The backend doesn't yet group variables into sections (no
  // sectionName on the real data), so step 1 vs step 2 is split by
  // isMandatory: required questions up front, optional ones after.
  // If section metadata is added later, swap this line for a real grouping.
  const detailFields = allVariables.filter((v) => v.isMandatory);
  const additionalFields = allVariables.filter((v) => !v.isMandatory);

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(allVariables.map((v) => [v.variableId, v.defaultValue ?? ""]))
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [requestedFor, setRequestedFor] = useState<RequestedFor>({ mode: "self", name: "" });

  const set = (id: number, val: string) => {
    setValues((prev) => ({ ...prev, [id]: val }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const validate = (fields: typeof allVariables) => {
    const newErrors: Record<number, string> = {};
    for (const v of fields) {
      if (v.isMandatory && !values[v.variableId]?.trim()) {
        newErrors[v.variableId] = `${v.label} is required`;
      }
    }
    if (requestedFor.mode === "other" && !requestedFor.name.trim()) {
      newErrors[-1] = "Enter a name or email for who this request is for";
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    const fieldsForStep = step === 0 ? detailFields : additionalFields;
    if (!validate(fieldsForStep)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = () => {
    if (!validate(detailFields)) {
      setStep(0);
      return;
    }
    onSubmit(values, requestedFor);
  };

  const answeredLabel = (v: (typeof allVariables)[number]) => values[v.variableId]?.trim() || "—";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        {/* Step indicator */}
        <div className="flex items-center">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    i < step
                      ? "bg-blue-600 text-white"
                      : i === step
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : "bg-slate-100 text-slate-400"
                  )}
                >
                  {i < step ? <Check className="size-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "hidden text-sm sm:inline",
                    i <= step ? "font-medium text-slate-800" : "text-slate-400"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("mx-3 h-0.5 flex-1 rounded", i < step ? "bg-blue-600" : "bg-slate-200")} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="pt-5 space-y-5">
            {step === 0 && (
              <>
                {catalog.allowRequestedFor && (
                  <div className="space-y-1.5">
                    <Label>Request For</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRequestedFor({ mode: "self", name: "" })}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                          requestedFor.mode === "self"
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <User className="size-4" /> Myself
                      </button>
                      <button
                        type="button"
                        onClick={() => setRequestedFor((r) => ({ ...r, mode: "other" }))}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                          requestedFor.mode === "other"
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <Users className="size-4" /> On behalf of someone else
                      </button>
                    </div>
                    {requestedFor.mode === "other" && (
                      <div className="pt-1.5">
                        <Input
                          placeholder="Name or email of the requester"
                          value={requestedFor.name}
                          onChange={(e) => setRequestedFor((r) => ({ ...r, name: e.target.value }))}
                        />
                        {errors[-1] && <p className="mt-1 text-xs text-red-500">{errors[-1]}</p>}
                      </div>
                    )}
                  </div>
                )}

                {detailFields.length === 0 && (
                  <p className="text-sm text-gray-500">No required details configured for this catalog item.</p>
                )}
                {detailFields.map((v) => (
                  <CatalogVariableField
                    key={v.variableId}
                    variable={v}
                    value={values[v.variableId]}
                    error={errors[v.variableId]}
                    onChange={(val) => set(v.variableId, val)}
                  />
                ))}
              </>
            )}

            {step === 1 && (
              <>
                {additionalFields.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No additional information is needed for this request — you can go straight to review.
                  </p>
                ) : (
                  additionalFields.map((v) => (
                    <CatalogVariableField
                      key={v.variableId}
                      variable={v}
                      value={values[v.variableId]}
                      error={errors[v.variableId]}
                      onChange={(val) => set(v.variableId, val)}
                    />
                  ))
                )}
              </>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Request Details</p>
                    <button type="button" onClick={() => setStep(0)} className="text-xs font-medium text-blue-600 hover:underline">
                      Edit
                    </button>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {catalog.allowRequestedFor && (
                      <div>
                        <dt className="text-xs text-slate-500">Requested For</dt>
                        <dd className="font-medium text-slate-800">
                          {requestedFor.mode === "self" ? "Myself" : requestedFor.name || "—"}
                        </dd>
                      </div>
                    )}
                    {detailFields.map((v) => (
                      <div key={v.variableId}>
                        <dt className="text-xs text-slate-500">{v.label}</dt>
                        <dd className="font-medium text-slate-800 truncate">{answeredLabel(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {additionalFields.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">Additional Information</p>
                      <button type="button" onClick={() => setStep(1)} className="text-xs font-medium text-blue-600 hover:underline">
                        Edit
                      </button>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {additionalFields.map((v) => (
                        <div key={v.variableId}>
                          <dt className="text-xs text-slate-500">{v.label}</dt>
                          <dd className="font-medium text-slate-800 truncate">{answeredLabel(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between gap-3 border-t border-slate-100 pt-5">
              <div>
                {step === 0 && onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                  </Button>
                )}
                {step > 0 && (
                  <Button type="button" variant="outline" onClick={goBack} disabled={isSubmitting}>
                    Back
                  </Button>
                )}
              </div>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={goNext}>
                  Next: {STEPS[step + 1]}
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                  {isSubmitting && <Spinner size="sm" />}
                  Submit Request
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Persistent summary panel */}
      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <CardContent className="pt-5 space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Request Summary</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{catalog.catalogName}</p>
              {catalog.shortDescription && (
                <p className="mt-1 text-sm text-slate-500">{catalog.shortDescription}</p>
              )}
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3 text-sm">
              {catalog.estimatedTime != null && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Timer className="size-4 text-slate-400" />
                  Estimated Time: {catalog.estimatedTime} mins
                </div>
              )}
              {catalog.deliveryTimeSla != null && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="size-4 text-slate-400" />
                  Delivery Time (SLA): {catalog.deliveryTimeSla} Working Hours
                </div>
              )}
            </div>

            {allVariables.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-medium text-slate-500">Your answers so far</p>
                <ul className="space-y-1.5 text-sm">
                  {allVariables.map((v) => {
                    const answered = !!values[v.variableId]?.trim();
                    return (
                      <li key={v.variableId} className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full",
                            answered ? "bg-blue-600 text-white" : "bg-slate-100"
                          )}
                        >
                          {answered && <Check className="size-2.5" />}
                        </span>
                        <span className={cn("truncate", answered ? "text-slate-700" : "text-slate-400")}>
                          {v.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
