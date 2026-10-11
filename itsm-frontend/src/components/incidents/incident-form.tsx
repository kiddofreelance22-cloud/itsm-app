"use client";

import { useRef, useState, useEffect, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  User,
  Phone,
  Mail,
  Grid3x3,
  Laptop,
  MapPin,
  Users,
  Activity,
  Clock,
  UploadCloud,
  Send,
  X,
  RotateCcw,
  ChevronRight,
  File as FileIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import { useIncidents } from "@/lib/hooks/use-incidents";
import { PriorityApi, ImpactApi, UrgencyApi, AssignmentGroupApi, LocationApi } from "@/lib/api/admin-modules.api";
import type { Category, Priority, Impact, Urgency, AssignmentGroup, Location } from "@/types/admin";
import { CategoryPickerModal } from "./category-picker-modal";

interface FormState {
  caller: string;
  contactNumber: string;
  emailId: string;
  categoryId: number | null;
  summary: string;
  description: string;
  priorityId: number | null;
  affectedAsset: string;
  locationId: number | null;
  assignmentGroupId: number | null;
  impactId: number | null;
  urgencyId: number | null;
}

const MAX_FILE_SIZE_MB = 10;
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf", ".docx"];

export function IncidentForm() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();
  const { create } = useIncidents();

  // API Data
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const [urgencies, setUrgencies] = useState<Urgency[]>([]);
  const [assignmentGroups, setAssignmentGroups] = useState<AssignmentGroup[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState<FormState>({
    caller: user?.fullName ?? "",
    contactNumber: user?.phone ?? "",
    emailId: user?.email ?? "",
    categoryId: null,
    summary: "",
    description: "",
    priorityId: null,
    affectedAsset: "",
    locationId: null,
    assignmentGroupId: null,
    impactId: null,
    urgencyId: null,
  });

  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [fileError, setFileError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch all dropdown data from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pris, imps, urgs, groups, locs] = await Promise.all([
          PriorityApi.list(),
          ImpactApi.list(),
          UrgencyApi.list(),
          AssignmentGroupApi.list(),
          LocationApi.list(),
        ]);
        
        setPriorities(pris);
        setImpacts(imps);
        setUrgencies(urgs);
        setAssignmentGroups(groups);
        setLocations(locs);

        if (pris.length > 0) {
          const mediumPriority = pris.find((p) => p.priorityName.toLowerCase() === "medium");
          setForm((prev) => ({ ...prev, priorityId: mediumPriority?.priorityId ?? pris[0].priorityId }));
        }
        if (imps.length > 0) {
          const mediumImpact = imps.find((i) => i.impactName.toLowerCase() === "medium");
          setForm((prev) => ({ ...prev, impactId: mediumImpact?.impactId ?? imps[0].impactId }));
        }
        if (urgs.length > 0) {
          const mediumUrgency = urgs.find((u) => u.urgencyName.toLowerCase() === "medium");
          setForm((prev) => ({ ...prev, urgencyId: mediumUrgency?.urgencyId ?? urgs[0].urgencyId }));
        }
        if (locs.length > 0) {
          setForm((prev) => ({ ...prev, locationId: locs[0].locationId }));
        }
      } catch (error) {
        console.error("Failed to fetch form data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCategorySelect(category: Category) {
    setSelectedCategory(category);
    update("categoryId", category.categoryId);
    setErrors((prev) => ({ ...prev, categoryId: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.caller.trim()) next.caller = "Caller is required.";
    if (!form.summary.trim()) next.summary = "Summary is required.";
    if (!form.description.trim()) next.description = "Description is required.";
    if (!form.categoryId) next.categoryId = "Category is required.";
    if (!form.priorityId) next.priorityId = "Priority is required.";
    if (!form.locationId) next.locationId = "Location is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFileError("");
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setFileError(`${file.name}: unsupported file type.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setFileError(`${file.name}: exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
        continue;
      }
      accepted.push(file);
    }
    setFiles((prev) => [...prev, ...accepted]);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    // Find display names for logging/info (optional)
    const priorityName = priorities.find((p) => p.priorityId === form.priorityId)?.priorityName;
    const impactName = impacts.find((i) => i.impactId === form.impactId)?.impactName;
    const urgencyName = urgencies.find((u) => u.urgencyId === form.urgencyId)?.urgencyName;
    const locationName = locations.find((l) => l.locationId === form.locationId)?.locationName;
    const assignmentGroupName = assignmentGroups.find((g) => g.groupId === form.assignmentGroupId)?.groupName;

    const newIncident = await create({
      title: form.summary,
      description: form.description,
      priority: (priorityName as "Low" | "Medium" | "High" | "Critical") || "Medium",
      impact: (impactName as "Low" | "Medium" | "High") || "Medium",
      urgency: (urgencyName as "Low" | "Medium" | "High") || "Medium",
      categoryId: form.categoryId ?? undefined,
      contactNumber: form.contactNumber,
      department: locationName || "General",
      affectedAsset: form.affectedAsset,
      assignmentGroupId: form.assignmentGroupId ?? undefined,
    });

    setSubmitting(false);

    if (newIncident) {
      setSubmitted(true);
      const detailPath = pathname.startsWith("/admin/incident")
        ? `/admin/incident/${newIncident.incidentId}`
        : `/incidents/${newIncident.incidentId}`;
      setTimeout(() => router.push(detailPath), 1200);
    }
  }

  function handleReset() {
    setForm({
      caller: user?.fullName ?? "",
      contactNumber: user?.phone ?? "",
      emailId: user?.email ?? "",
      categoryId: null,
      summary: "",
      description: "",
      priorityId: priorities.find((p) => p.priorityName.toLowerCase() === "medium")?.priorityId ?? priorities[0]?.priorityId ?? null,
      affectedAsset: "",
      locationId: locations.length > 0 ? locations[0].locationId : null,
      assignmentGroupId: null,
      impactId: impacts.find((i) => i.impactName.toLowerCase() === "medium")?.impactId ?? impacts[0]?.impactId ?? null,
      urgencyId: urgencies.find((u) => u.urgencyName.toLowerCase() === "medium")?.urgencyId ?? urgencies[0]?.urgencyId ?? null,
    });
    setSelectedCategory(null);
    setFiles([]);
    setErrors({});
    setFileError("");
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-green-200 bg-green-50 p-10 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-green-600 text-white">
          <Send className="size-5" />
        </span>
        <p className="text-lg font-semibold text-green-800">Incident submitted successfully</p>
        <p className="text-sm text-green-700">Redirecting you to the incident details…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-10">
        <p className="text-sm text-slate-600">Loading form data...</p>
      </div>
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
        <div>
          <Label htmlFor="caller" required>
            Caller
          </Label>
          <Input
            id="caller"
            value={form.caller}
            onChange={(e) => update("caller", e.target.value)}
            leadingIcon={<User />}
            trailingIcon={
              form.caller ? (
                <button type="button" onClick={() => update("caller", "")} aria-label="Clear caller">
                  <X className="size-4" />
                </button>
              ) : undefined
            }
            invalid={!!errors.caller}
            aria-invalid={!!errors.caller}
          />
          <FieldError message={errors.caller} />
        </div>

        <div>
          <Label htmlFor="contact">Contact Number</Label>
          <Input
            id="contact"
            value={form.contactNumber}
            onChange={(e) => update("contactNumber", e.target.value)}
            leadingIcon={<Phone />}
          />
        </div>

        <div>
          <Label htmlFor="email">Email ID</Label>
          <Input
            id="email"
            type="email"
            value={form.emailId}
            onChange={(e) => update("emailId", e.target.value)}
            leadingIcon={<Mail />}
          />
        </div>

        <div>
          <Label htmlFor="category" required>
            Category
          </Label>
          <button
            type="button"
            id="category"
            onClick={() => setCategoryPickerOpen(true)}
            className={`flex h-11 w-full items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm shadow-sm outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-100 ${
              errors.categoryId ? "border-red-400" : "border-slate-300 focus-visible:border-brand-500"
            }`}
          >
            <Grid3x3 className="size-4 shrink-0 text-slate-400" />
            <span className={selectedCategory ? "flex items-center gap-1 truncate text-slate-800" : "text-slate-400"}>
              {selectedCategory ? (
                <>
                  {selectedCategory.parent?.categoryName && (
                    <span className="text-slate-400">{selectedCategory.parent.categoryName}
                      <ChevronRight className="mx-0.5 inline size-3 text-slate-300" />
                    </span>
                  )}
                  {selectedCategory.categoryName}
                </>
              ) : (
                "Select a category"
              )}
            </span>
          </button>
          <FieldError message={errors.categoryId} />
        </div>

        <div>
          <Label htmlFor="summary" required>
            Summary
          </Label>
          <Input
            id="summary"
            value={form.summary}
            onChange={(e) => update("summary", e.target.value)}
            placeholder="Brief summary of the issue"
            invalid={!!errors.summary}
          />
          <FieldError message={errors.summary} />
        </div>

        <div>
          <Label htmlFor="description" required>
            Description
          </Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Describe the issue in detail"
            invalid={!!errors.description}
          />
          <FieldError message={errors.description} />
        </div>

        <div>
          <Label htmlFor="priority" required>
            Priority
          </Label>
          <Select
            id="priority"
            value={form.priorityId ?? ""}
            onChange={(e) => update("priorityId", e.target.value ? Number(e.target.value) : null)}
            leadingIcon={<PriorityDot priority={priorities.find((p) => p.priorityId === form.priorityId)?.priorityName ?? ""} />}
          >
            <option value="">Select priority</option>
            {priorities.map((p) => (
              <option key={p.priorityId} value={p.priorityId}>
                {p.priorityName}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="affectedAsset">Affected Asset</Label>
          <Select
            id="affectedAsset"
            value={form.affectedAsset}
            onChange={(e) => update("affectedAsset", e.target.value)}
            leadingIcon={<Laptop />}
          >
            <option value="">Select an asset</option>
            {/* TODO: Fetch asset list from backend */}
          </Select>
        </div>

        <div>
          <Label htmlFor="location" required>
            Location
          </Label>
          <Select
            id="location"
            value={form.locationId ?? ""}
            onChange={(e) => update("locationId", e.target.value ? Number(e.target.value) : null)}
            leadingIcon={<MapPin />}
            invalid={!!errors.locationId}
          >
            <option value="">Select a location</option>
            {locations.map((l) => (
              <option key={l.locationId} value={l.locationId}>
                {l.locationName}
              </option>
            ))}
          </Select>
          <FieldError message={errors.locationId} />
        </div>

        <div>
          <Label htmlFor="impact">Impact</Label>
          <Select
            id="impact"
            value={form.impactId ?? ""}
            onChange={(e) => update("impactId", e.target.value ? Number(e.target.value) : null)}
            leadingIcon={<Activity />}
          >
            <option value="">Select impact</option>
            {impacts.map((i) => (
              <option key={i.impactId} value={i.impactId}>
                {i.impactName}
              </option>
            ))}
          </Select>
        </div>

        {isAdmin && (
          <div>
            <Label htmlFor="assignmentGroup">Assignment Group</Label>
            <Select
              id="assignmentGroup"
              value={form.assignmentGroupId ?? ""}
              onChange={(e) => update("assignmentGroupId", e.target.value ? Number(e.target.value) : null)}
              leadingIcon={<Users />}
            >
              <option value="">Select an assignment group</option>
              {assignmentGroups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupName}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500">
              Only Admins/Fulfillers can set the group at creation. Otherwise it is assigned after the incident is logged.
            </p>
          </div>
        )}

        <div>
          <Label htmlFor="urgency">Urgency</Label>
          <Select
            id="urgency"
            value={form.urgencyId ?? ""}
            onChange={(e) => update("urgencyId", e.target.value ? Number(e.target.value) : null)}
            leadingIcon={<Clock />}
          >
            <option value="">Select urgency</option>
            {urgencies.map((u) => (
              <option key={u.urgencyId} value={u.urgencyId}>
                {u.urgencyName}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-5">
        <Label>Attachment</Label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          aria-label="Drag and drop files here or click to browse"
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragActive ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
          }`}
        >
          <UploadCloud className="size-6 text-brand-500" aria-hidden="true" />
          <p className="text-sm text-slate-600">
            <span className="font-medium text-brand-600">Drag and drop files here</span> or click to browse
          </p>
          <p className="text-xs text-slate-400">Supported files: jpg, png, pdf, docx (Max size: 10MB)</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            onChange={(e: ChangeEvent<HTMLInputElement>) => addFiles(e.target.files)}
          />
        </div>
        {fileError && <p className="mt-1.5 text-sm text-red-600">{fileError}</p>}

        {files.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {files.map((file) => (
              <li
                key={file.name}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 truncate text-slate-700">
                  <FileIcon className="size-4 shrink-0 text-slate-400" />
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(file.name)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
        <div className="flex gap-3">
          <Button type="submit" loading={submitting}>
            <Send className="size-4" /> {submitting ? "Submitting..." : "Submit"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/home")}>
            <X className="size-4" /> Cancel
          </Button>
        </div>
        <Button type="button" variant="outline" onClick={handleReset}>
          <RotateCcw className="size-4" /> Reset
        </Button>
      </div>
    </form>
    <CategoryPickerModal
      open={categoryPickerOpen}
      initialCategoryId={form.categoryId}
      onSelect={handleCategorySelect}
      onClose={() => setCategoryPickerOpen(false)}
    />
    </>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const color =
    priority === "High" || priority === "Critical"
      ? "bg-red-600"
      : priority === "Medium"
      ? "bg-amber-500"
      : "bg-green-600";
  return <span className={`size-2.5 rounded-full ${color}`} aria-hidden="true" />;
}
