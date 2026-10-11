import React, { useEffect, useState } from "react";
import { UserRound, User } from "lucide-react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { directoryApi, type MappingRow } from "../configApi";

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [customAttrs, setCustomAttrs] = useState<MappingRow[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user?.id) return;
    api.get<Record<string, any>>(`/users/${user.id}`)
      .then((res) => {
        setProfile(res);
        const localCustom = localStorage.getItem(`user_custom_${user.id}`);
        if (localCustom) {
          try { setCustomValues(JSON.parse(localCustom)); } catch {}
        }
      })
      .catch(() => {});

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
