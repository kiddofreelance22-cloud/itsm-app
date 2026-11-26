import React, { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Save, UserRound, User } from "lucide-react";
import { useAuth } from "../AuthContext";
import { api, assetUrl } from "../api";
import { directoryApi, type MappingRow } from "../configApi";

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const photoInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [customAttrs, setCustomAttrs] = useState<MappingRow[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    api.get<Record<string, any>>("/users/me")
      .then((res) => {
        setProfile(res);
        const localCustom = localStorage.getItem(`user_custom_${user.id}`);
        if (localCustom) {
          try { setCustomValues(JSON.parse(localCustom)); } catch {}
        }
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Unable to load profile."));

    directoryApi.customAttributes()
      .then((items) => setCustomAttrs(items))
      .catch(async () => {
        try {
          const srcList = await directoryApi.sources();
          const all: MappingRow[] = [];
          for (const s of srcList) {
            const maps = await directoryApi.mappings(s.sourceId);
            all.push(...maps);
          }
          const standardFields = new Set([
            "full name", "email address", "department", "job title",
            "phone number", "office location", "user principal name (reference)",
            "first name", "last name", "display name", "email id", "employee id",
            "manager", "business service", "location", "user type", "active",
          ]);
          const seen = new Set<string>();
          const custom = all.filter((m) => {
            const k = m.localField?.trim().toLowerCase();
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return m.isActive && (m.isCustom || !standardFields.has(k));
          });
          setCustomAttrs(custom);
        } catch {}
      });
  }, [user?.id]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    try {
      const updated = await api.patch<Record<string, any>>("/users/me", { fullName, email });
      setProfile((current) => ({ ...current, ...updated }));
      updateUser({ name: updated.fullName ?? fullName, email: updated.email ?? email });
      setEditing(false);
      setMessage("Profile updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const uploadPicture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Choose an image smaller than 5 MB.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const uploaded = await api.upload<{ url?: string; data?: { url?: string } }>("/uploads", body);
      const profilePhotoUrl = uploaded.data?.url ?? uploaded.url;
      if (!profilePhotoUrl) throw new Error("The upload did not return an image URL.");
      const updated = await api.patch<Record<string, any>>("/users/me", { profilePhotoUrl });
      setProfile((current) => ({ ...current, ...updated }));
      updateUser({ profilePhotoUrl });
      setMessage("Profile picture updated.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to update profile picture.");
    } finally {
      setUploading(false);
    }
  };

  const getAttrValue = (ca: MappingRow) => {
    const trimmed = ca.localField.trim();
    const slug = trimmed.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");
    const lowerSlug = slug.charAt(0).toLowerCase() + slug.slice(1);
    const customKey = `custom_${lowerSlug || ca.mappingId}`;
    return profile[lowerSlug] ?? customValues[customKey] ?? customValues[lowerSlug] ?? "—";
  };
  
  return (
    <div className="dash">
      <div className="dash-main" style={{ width: "100%" }}>
        <header className="dash-hello">
          <h1>My Profile</h1>
          <p>Manage your account settings.</p>
        </header>

        <section className="card dash-panel" style={{ marginBottom: 20 }}>
          <div className="dash-panel-head">
            <h2><User size={18} style={{ marginRight: 8 }} /> User Information</h2>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <input ref={photoInput} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadPicture} aria-label="Upload profile picture" />
              <button type="button" className="btn-ghost" onClick={() => photoInput.current?.click()} disabled={uploading}>
                <Camera size={14} /> {uploading ? "Uploading..." : "Change picture"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setEditing((current) => !current)} disabled={saving}>
                {editing ? "Cancel" : "Edit profile"}
              </button>
            </div>
          </div>
          {message && <p role="status" style={{ padding: "8px 16px", color: message.includes("updated") ? "#067647" : "#B42318" }}>{message}</p>}
          {editing ? (
            <form onSubmit={saveProfile} style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
              <label>Full Name<input className="input" name="fullName" defaultValue={profile.fullName ?? user?.name ?? ""} required /></label>
              <label>Email<input className="input" name="email" type="email" defaultValue={profile.email ?? user?.email ?? ""} required /></label>
              <button className="btn-primary" type="submit" disabled={saving}><Save size={14} /> {saving ? "Saving..." : "Save changes"}</button>
            </form>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px 8px" }}>
            {profile.profilePhotoUrl && <img src={assetUrl(profile.profilePhotoUrl)} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />}
          </div>
          <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
            <p><strong>First Name:</strong> {profile.firstName ?? user?.name?.split(" ")[0] ?? "—"}</p>
            <p><strong>Last Name:</strong> {profile.lastName ?? user?.name?.split(" ").slice(1).join(" ") ?? "—"}</p>
            <p><strong>Display Name:</strong> {profile.displayName ?? user?.name ?? "—"}</p>
            <p><strong>Email ID:</strong> {profile.email ?? user?.email ?? "—"}</p>
            <p><strong>Phone Number:</strong> {profile.phone ?? "—"}</p>
            <p><strong>Employee ID:</strong> {profile.employeeId ?? "—"}</p>
            <p><strong>Job Title:</strong> {profile.jobTitle ?? "—"}</p>
            <p><strong>Department:</strong> {profile.department?.departmentName ?? profile.department ?? "—"}</p>
            <p><strong>Location:</strong> {profile.location ?? "—"}</p>
            <p><strong>User Type:</strong> {profile.userType ?? "Internal"}</p>
            {customAttrs.map((ca) => (
              <p key={ca.mappingId ?? ca.localField}>
                <strong>{ca.localField}:</strong> {getAttrValue(ca)}
              </p>
            ))}
          </div>
        </section>

        <section className="card dash-panel">
          <div className="dash-panel-head">
            <h2><UserRound size={18} style={{ marginRight: 8 }} /> Account Information</h2>
          </div>
          <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px" }}>
            <p><strong>Username:</strong> {profile.username ?? (user as any)?.username ?? user?.email ?? "—"}</p>
            <p><strong>Role:</strong> {user?.role ?? "—"}</p>
            <p><strong>Status:</strong> {profile.isActive !== false ? "Active" : "Inactive"}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
