"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
  File as FileIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import { useIncidents } from "@/lib/hooks/use-incidents";
import { useAdminCategories } from "@/lib/hooks/use-admin";

const categoryOptions = [
  { label: "Hardware", subCategories: ["Laptop", "Desktop", "Printer", "Monitor", "Peripherals"] },
  { label: "Software", subCategories: ["Email", "Operating System", "Application", "License"] },
  { label: "Network", subCategories: ["Wi-Fi", "VPN", "LAN", "Internet Access"] },
  { label: "Access", subCategories: ["Account Lockout", "Password Reset", "Permissions"] },
] as const;

const locationOptions = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Hyderabad", "Chennai"];

const assignmentGroupOptions = [
  "Desktop Support",
  "Network Support",
  "Hardware Support",
  "Software Support",
  "Service Desk",
];

const priorityOptions = ["Low", "Medium", "High", "Critical"] as const;
const impactOptions = ["Low", "Medium", "High"] as const;
const urgencyOptions = ["Low", "Medium", "High"] as const;

const assetOptions = ["Laptop-001", "Laptop-014", "Desktop-022", "Printer-005", "Monitor-009"];

interface FormState {
  caller: string;
  contactNumber: string;
  emailId: string;
  category: string;
  summary: string;
  subCategory: string;
  description: string;
  priority: string;
  affectedAsset: string;
  location: string;
  assignmentGroup: string;
  impact: string;
  urgency: string;
}

const MAX_FILE_SIZE_MB = 10;
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf", ".docx"];

export function IncidentForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { create } = useIncidents();
  const { categories } = useAdminCategories();
  
  const initialState: FormState = {
    caller: user?.fullName ?? "",
    contactNumber: user?.phone ?? "",
    emailId: user?.email ?? "",
    category: categoryOptions[1].label,
    summary: "",
    subCategory: categoryOptions[1].subCategories[0],
    description: "",
    priority: "Medium",
    affectedAsset: "",
    location: "Mumbai",
    assignmentGroup: assignmentGroupOptions[0],
    impact: "Medium",
    urgency: "Medium",
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(initialState);
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [fileError, setFileError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const subCategories =
    categoryOptions.find((c) => c.label === form.category)?.subCategories ?? [];

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      if (key === "category") {
        const next = categoryOptions.find((c) => c.label === value);
        return { ...prev, category: value, subCategory: next?.subCategories[0] ?? "" };
      }
      return { ...prev, [key]: value };
    });
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.caller.trim()) next.caller = "Caller is required.";
    if (!form.summary.trim()) next.summary = "Summary is required.";
    if (!form.description.trim()) next.description = "Description is required.";
    if (!form.category) next.category = "Category is required.";
    if (!form.subCategory) next.subCategory = "Sub category is required.";
    if (!form.priority) next.priority = "Priority is required.";
    if (!form.location) next.location = "Location is required.";
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
    
    // Find the categoryId if a matching one exists in the DB
    const cat = categories.find((c) => c.categoryName.toLowerCase() === form.category.toLowerCase());

    // Map all the rich form fields into the description so no data is lost
    const fullDescription = [
      `Caller: ${form.caller}`,
      form.contactNumber ? `Contact Number: ${form.contactNumber}` : null,
      form.emailId ? `Email ID: ${form.emailId}` : null,
      `Category: ${form.category} (${form.subCategory})`,
      `Location: ${form.location}`,
      form.affectedAsset ? `Affected Asset: ${form.affectedAsset}` : null,
      `Assignment Group: ${form.assignmentGroup}`,
      `Impact: ${form.impact}`,
      `Urgency: ${form.urgency}`,
      ``,
      `Description:`,
      form.description
    ].filter(Boolean).join("\n");

    const newIncident = await create({
      title: form.summary,
      description: fullDescription,
      priority: form.priority as "Low" | "Medium" | "High" | "Critical",
      categoryId: cat?.categoryId,
    });

    setSubmitting(false);

    if (newIncident) {
      setSubmitted(true);
      setTimeout(() => router.push(`/incidents/${newIncident.incidentId}`), 1200);
    }
  }

  function handleReset() {
    setForm(initialState);
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

  return (
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
          <Select
            id="category"
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            leadingIcon={<Grid3x3 />}
            invalid={!!errors.category}
          >
            {categoryOptions.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </Select>
          <FieldError message={errors.category} />
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
          <Label htmlFor="subCategory" required>
            Sub Category
          </Label>
          <Select
            id="subCategory"
            value={form.subCategory}
            onChange={(e) => update("subCategory", e.target.value)}
            leadingIcon={<Laptop />}
            invalid={!!errors.subCategory}
          >
            {subCategories.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <FieldError message={errors.subCategory} />
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
            value={form.priority}
            onChange={(e) => update("priority", e.target.value)}
            leadingIcon={<PriorityDot priority={form.priority} />}
          >
            {priorityOptions.map((p) => (
              <option key={p}>{p}</option>
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
            {assetOptions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="location" required>
            Location
          </Label>
          <Select
            id="location"
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            leadingIcon={<MapPin />}
            invalid={!!errors.location}
          >
            {locationOptions.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
          <FieldError message={errors.location} />
        </div>

        <div>
          <Label htmlFor="impact">Impact</Label>
          <Select
            id="impact"
            value={form.impact}
            onChange={(e) => update("impact", e.target.value)}
            leadingIcon={<Activity />}
          >
            {impactOptions.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="assignmentGroup">Assignment Group</Label>
          <Select
            id="assignmentGroup"
            value={form.assignmentGroup}
            onChange={(e) => update("assignmentGroup", e.target.value)}
            leadingIcon={<Users />}
          >
            {assignmentGroupOptions.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="urgency">Urgency</Label>
          <Select
            id="urgency"
            value={form.urgency}
            onChange={(e) => update("urgency", e.target.value)}
            leadingIcon={<Clock />}
          >
            {urgencyOptions.map((u) => (
              <option key={u}>{u}</option>
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
