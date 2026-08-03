"use client";

import { useState } from "react";
import { type ElementType } from "react";
import { Mail, Phone, Save } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/hooks/use-auth";
import { UsersApi } from "@/lib/api/users.api";
import { useToast } from "@/lib/hooks/use-toast";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: user?.fullName ?? "", email: user?.email ?? "" });

  const initials = (user?.fullName ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await UsersApi.update(user.userId, { fullName: form.fullName, email: form.email });
      toast({ title: "Profile updated", variant: "success" });
      setEditing(false);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "My Profile" }]} />
      <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your personal information.</p>

      <Card className="mt-6">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center sm:flex-row sm:text-left">
          <Avatar className="size-20">
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-lg font-semibold text-slate-900">{user?.fullName}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {user?.roles.map((r) => (
                <span key={r} className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{r}</span>
              ))}
            </div>
            {!editing && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => setEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>
        </CardContent>

        <CardContent className="border-t border-slate-100 pt-5">
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Spinner size="sm" /> : <Save className="size-4" />} Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email" value={user?.email ?? "—"} />
              <InfoRow icon={Phone} label="Username" value={user?.username ?? "—"} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}
