import React, { useEffect, useRef, useState } from "react";
import {
  Bell, ChevronDown, ClipboardList, FilePlus2, Home, Inbox, LayoutDashboard,
  LogOut, Search, Settings, UserRound, X, type LucideIcon,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { Link, useRouter } from "../router";
import { api } from "../api";
import { useAsync } from "../hooks";
import { buildNav, buildNavFromAllowed, type CollapsibleGroup, type FlatSection, type NavigationItem } from "./navConfig";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { path } = useRouter();
  const [navQuery, setNavQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (to: string) => path === to || path.startsWith(to + "/");

  // Role > Navigation Access (when an admin has configured it) decides what a non-admin sees.
  const access = useAsync(() => api.get<{ configured: boolean; items: { navKey: string; visible: boolean; canCreate: boolean }[] }>("/navigation/me").catch(() => ({ configured: false, items: [] })), [user?.role]);
  const allowed = access.data?.configured ? new Set(access.data.items.filter((i) => i.visible).map((i) => i.navKey)) : null;
  const ownDashboard = user?.role === "ADMIN" ? "/admin-dashboard" : user?.role === "RESOLVER" ? "/resolver-dashboard" : "/my-dashboard";
  // Admins keep the full built-in menu (trimmed only by what is unticked). Everyone else gets a menu
  // built from the ticked items across all screens, so custom roles are not limited to their base menu.
  const fromTicked = allowed && user?.role !== "ADMIN" ? buildNavFromAllowed(allowed, [ownDashboard]) : null;
  const { flatSections: baseFlatSections, configGroup: baseConfigGroup } = fromTicked ?? buildNav(user?.role);
  const keep = (it: NavigationItem) => !allowed || !it.to.startsWith("/") || allowed.has(it.to) || it.to === "/my-dashboard" || it.to === "/resolver-dashboard" || it.to === "/admin-dashboard";
  const flatSections: FlatSection[] = baseFlatSections.map((sec) => ({ ...sec, items: sec.items.filter(keep) })).filter((sec) => sec.items.length > 0);
  const configGroup: CollapsibleGroup | null = baseConfigGroup
    ? { ...baseConfigGroup, subgroups: baseConfigGroup.subgroups.map((g) => ({ ...g, items: g.items.filter(keep) })).filter((g) => g.items.length > 0) }
    : null;

  const normalizedQuery = navQuery.trim().toLowerCase();

  // Filter flat sections
  const filteredFlatSections = flatSections.map((section) => ({
    ...section,
    items: normalizedQuery
      ? section.items.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
      : section.items,
  })).filter((section) => section.items.length > 0);

  // Filter config subgroups
  const filteredConfigSubgroups = configGroup
    ? configGroup.subgroups
        .map((subgroup) => ({
          ...subgroup,
          items: normalizedQuery
            ? subgroup.items.filter((item) =>
                item.label.toLowerCase().includes(normalizedQuery) ||
                subgroup.title.toLowerCase().includes(normalizedQuery)
              )
            : subgroup.items,
        }))
        .filter((subgroup) => subgroup.items.length > 0)
    : [];

  const configHasActive = configGroup
    ? configGroup.subgroups.flatMap((s) => s.items).some((item) => isActive(item.to))
    : false;
  const configExpanded =
    normalizedQuery.length > 0 || ((expandedGroups["CONFIGURATION"] ?? configHasActive) || true);

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            <span style={{ background: "#5B9BF0" }} />
            <span style={{ background: "#175CD3" }} />
            <span style={{ background: "#175CD3" }} />
            <span style={{ background: "#5B9BF0" }} />
          </div>
          Meridian
        </div>
        <div className="topbar-right">
          {user && (
            <>
              <button aria-label="Notifications" style={{ display: "flex", alignItems: "center" }}>
                <Bell aria-hidden="true" size={16} />
              </button>
              <div className="topbar-user-wrapper" ref={userMenuRef}>
                <button
                  className="topbar-user"
                  aria-label="User menu"
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((open) => !open)}
                >
                  {initialsOf(user.name)}
                </button>
                {userMenuOpen && (
                  <div className="user-dropdown" role="menu">
                    <div className="user-dropdown-info">
                      <div className="user-dropdown-name">{user.name}</div>
                      <div className="user-dropdown-role">{user.role}</div>
                    </div>
                    <div className="user-dropdown-divider" />
                    <button
                      className="user-dropdown-logout"
                      role="menuitem"
                      onClick={() => { setUserMenuOpen(false); logout(); }}
                    >
                      <LogOut size={14} aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="body-row">
        {user && (
          <div className={`sidebar ${user.role === "RESOLVER" ? "sidebar-analyst" : ""}`}>
            <div className="sidebar-search">
              <Search aria-hidden="true" size={14} />
              <input
                type="search"
                aria-label="Filter navigator"
                placeholder="Filter navigator"
                value={navQuery}
                onChange={(event) => setNavQuery(event.target.value)}
              />
              {navQuery && (
                <button type="button" aria-label="Clear navigator filter" onClick={() => setNavQuery("")}>
                  <X aria-hidden="true" size={14} />
                </button>
              )}
            </div>
            <nav className="sidebar-nav" aria-label="Application navigation">
              {/* Flat sections: role-specific workspace navigation */}
              {filteredFlatSections.map((section) => (
                <section className={`sidebar-section ${user.role === "RESOLVER" ? "analyst-sidebar-section" : ""}`} key={section.title}>
                  <div className="sidebar-section-heading">{section.title}</div>
                  {section.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`sidebar-item ${isActive(item.to) ? "active" : ""}`}
                    >
                      {item.icon && <item.icon className="sidebar-item-icon" aria-hidden="true" size={18} />}
                      {item.label}
                    </Link>
                  ))}
                </section>
              ))}

              {/* Collapsible CONFIGURATION section */}
              {configGroup && (!normalizedQuery || filteredConfigSubgroups.length > 0) && (
                <section className="sidebar-section" key="CONFIGURATION">
                  <button
                    type="button"
                    className={`sidebar-section-heading sidebar-config-toggle ${configHasActive ? "has-active" : ""}`}
                    aria-expanded={configExpanded}
                    onClick={() =>
                      setExpandedGroups((current) => ({
                        ...current,
                        CONFIGURATION: !(current["CONFIGURATION"] ?? true),
                      }))
                    }
                  >
                    <span>CONFIGURATION</span>
                    <ChevronDown aria-hidden="true" size={13} className={configExpanded ? "expanded" : ""} />
                  </button>
                  {configExpanded && (
                    <div>
                      {filteredConfigSubgroups.map((subgroup) => (
                        <div key={subgroup.title}>
                          <div className="sidebar-subgroup">{subgroup.title}</div>
                          {subgroup.items.map((item) => (
                            <Link
                              key={item.to}
                              to={item.to}
                              className={`sidebar-item sidebar-subitem ${isActive(item.to) ? "active" : ""}`}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {normalizedQuery &&
                filteredFlatSections.length === 0 &&
                filteredConfigSubgroups.length === 0 && (
                  <div className="sidebar-empty">No navigation items found</div>
                )}
            </nav>
            {user.role === "RESOLVER" && (
                <div className="sidebar-footer">
                  <button type="button" className="sidebar-logout" onClick={logout}>
                    <LogOut aria-hidden="true" size={18} />
                    Logout
                  </button>
                </div>
            )}
          </div>
        )}
        <div className="main">{children}</div>
      </div>
    </div>
  );
}
