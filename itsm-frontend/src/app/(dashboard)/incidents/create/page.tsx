"use client";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { IncidentForm } from "@/components/incidents/incident-form";

export default function CreateIncidentPage() {
  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "My Incidents", href: "/incidents" }, { label: "Create" }]} />
      <h1 className="text-2xl font-bold text-slate-900">Create New Incident</h1>
      <p className="mt-1 text-sm text-slate-500">Please provide the details below to raise a new incident.</p>

      <div className="mt-6">
        <IncidentForm />
      </div>
    </div>
  );
}