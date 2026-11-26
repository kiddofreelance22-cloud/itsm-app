"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { type ElementType } from "react";
import { BriefcaseBusiness, Building2, Camera, IdCard, Mail, MapPin, Phone, Save, UserRound } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/hooks/use-auth";
import { UsersApi } from "@/lib/api/users.api";
import { useToast } from "@/lib/hooks/use-toast";
import { uploadFile } from "@/lib/api/uploads.api";
import { resolveAssetUrl } from "@/lib/api/client";
import type { AdminUser } from "@/types/admin";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const photoInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({ fullName: user?.fullName ?? "", email: user?.email ?? "" });

  const initials = (user?.fullName ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingProfile(true);
    UsersApi.getMe()
      .then((details) => {
        if (!active) return;
        setProfile(details);
        setForm({ fullName: details.fullName ?? "", email: details.email ?? "" });
      })
      .catch((e: unknown) => {
        if (active) {
          toast({ title: "Unable to load profile", description: e instanceof Error ? e.message : String(e), variant: "error" });
        }
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });
    return () => { active = false; };
  }, [user?.userId, toast]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updatedProfile = await UsersApi.updateMe({ fullName: form.fullName, email: form.email });
      setProfile(updatedProfile);
      updateUser({ fullName: updatedProfile.fullName, email: updatedProfile.email });
      toast({ title: "Profile updated", variant: "success" });
      setEditing(false);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e instanceof Error ? e.message : String(e)), variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image file", variant: "error" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image is too large", description: "Choose an image smaller than 5 MB.", variant: "error" });
      return;
    }
    if (!user) return;

    setUploading(true);
    try {
      const uploaded = await uploadFile(file);
      const updatedProfile = await UsersApi.updateMe({ profilePhotoUrl: uploaded.url });
      setProfile(updatedProfile);
      updateUser({ profilePhotoUrl: updatedProfile.profilePhotoUrl });
      toast({ title: "Profile picture updated", variant: "success" });
    } catch (e: unknown) {
      toast({ title: "Unable to update profile picture", description: e instanceof Error ? e.message : String(e), variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <Breadcrumb items={[{ label: "Home", href: "/home" }, { label: "My Profile" }]} />
      <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
      <p className="mt-1 text-sm text-slate-500">View and manage your personal information.</p>

      <Card className="mt-6">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center sm:flex-row sm:text-left">
          <Avatar className="size-20">
            <AvatarImage src={resolveAssetUrl(profile?.profilePhotoUrl ?? user?.profilePhotoUrl)} alt="" />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-lg font-semibold text-slate-900">{profile?.fullName ?? user?.fullName}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {(user?.roles ?? []).map((r) => (
                <span key={r} className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{r}</span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handlePhotoChange}
                aria-label="Upload profile picture"
              />
              <Button variant="secondary" size="sm" className="gap-2" onClick={() => photoInput.current?.click()} disabled={uploading}>
                {uploading ? <Spinner size="sm" /> : <Camera className="size-4" />}
                {uploading ? "Uploading..." : "Change picture"}
              </Button>
              {!editing && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit Profile
              </Button>
              )}
            </div>
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
                <Button variant="outline" onClick={() => {
                  setForm({ fullName: profile?.fullName ?? "", email: profile?.email ?? "" });
                  setEditing(false);
                }} disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  {saving ? <Spinner size="sm" /> : <Save className="size-4" />} Save Changes
                </Button>
              </div>
            </div>
          ) : loadingProfile ? (
            <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
              <Spinner size="sm" /> Loading profile details...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow icon={Mail} label="Email" value={profile?.email ?? user?.email ?? "—"} />
              <InfoRow icon={UserRound} label="Username" value={profile?.username ?? user?.username ?? "—"} />
              <InfoRow icon={Phone} label="Phone" value={profile?.phone ?? "—"} />
              <InfoRow icon={IdCard} label="Employee ID" value={profile?.employeeId ?? "—"} />
              <InfoRow icon={BriefcaseBusiness} label="Job title" value={profile?.jobTitle ?? "—"} />
              <InfoRow icon={Building2} label="Department" value={profile?.department?.departmentName ?? "—"} />
              <InfoRow icon={MapPin} label="Location" value={profile?.location ?? "—"} />
              <InfoRow icon={UserRound} label="User type" value={profile?.userType ?? "—"} />
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
