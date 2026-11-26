import React, { useEffect, useRef, useState } from "react";
import {
  Bell, ChevronDown, LogOut, Search, UserRound, X,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { Link, useRouter } from "../router";
import { api, assetUrl } from "../api";
import { useAsync } from "../hooks";
import { buildNav, buildNavFromAllowed, type CollapsibleGroup, type FlatSection, type NavigationItem } from "./navConfig";
import { isPendingApproval, loadApprovalHub, type ApprovalHubItem, type ApprovalHubResult } from "../approvalHub";
import { incidentApi } from "../incidentApi";
import { serviceRequestApi, requestLifecycleApi } from "../requestsApi";
import { knowledgeApi } from "../knowledgeApi";
import { changeApi, type Change } from "../changeApi";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

// Module-level persistence so sidebar scroll survives page navigation and component remounts
let savedSidebarScrollTop = 0;

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout, switchUser, extendSupportSession: extendSupportSessionFromAuth, stopSwitching } = useAuth();
  const { path, navigate } = useRouter();
  const [navQuery, setNavQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchSearch, setSwitchSearch] = useState("");
  const [switchUsers, setSwitchUsers] = useState<{ userId: number; fullName: string; email: string; roles: string[] }[]>([]);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [switchStarting, setSwitchStarting] = useState(false);
  const [supportTarget, setSupportTarget] = useState<{ userId: number; fullName: string } | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationData, setNotificationData] = useState<ApprovalHubResult | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [clearedNotificationIds, setClearedNotificationIds] = useState<string[]>([]);
  const [supportSecondsLeft, setSupportSecondsLeft] = useState<number | null>(null);
  const [supportExpiryPrompt, setSupportExpiryPrompt] = useState(false);
  const [supportExtending, setSupportExtending] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalOpen, setGlobalOpen] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalIncidents, setGlobalIncidents] = useState<{ id: string; code: string; title: string; href: string }[]>([]);
  const [globalRequests, setGlobalRequests] = useState<{ id: string; code: string; title: string; href: string }[]>([]);
  const [globalKnowledge, setGlobalKnowledge] = useState<{ id: string; code: string; title: string; href: string }[]>([]);
  const [globalChanges, setGlobalChanges] = useState<{ id: string; code: string; title: string; href: string }[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const sidebarNavRef = useRef<HTMLElement>(null);
  const notificationStorageKey = user ? `meridian_cleared_notifications_${user.id}` : null;
  const pendingNotifications = (notificationData?.items.filter(isPendingApproval) ?? [])
    .slice()
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  const visibleNotifications = pendingNotifications.filter((item) => !clearedNotificationIds.includes(item.id));

  useEffect(() => {
    if (!notificationStorageKey) {
      setClearedNotificationIds([]);
      return;
    }
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(notificationStorageKey) ?? "[]");
      setClearedNotificationIds(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setClearedNotificationIds([]);
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    if (!user?.actingAs) {
      setSupportSecondsLeft(null);
      setSupportExpiryPrompt(false);
      return;
    }
    const updateCountdown = () => {
      const expiresAt = user.supportExpiresAt ?? Date.now();
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSupportSecondsLeft(seconds);
      if (seconds > 0 && seconds <= 300) setSupportExpiryPrompt(true);
      if (seconds === 0) setSupportExpiryPrompt(true);
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [user?.actingAs, user?.supportExpiresAt, user?.impersonationId]);

  const handleLogout = () => {
    savedSidebarScrollTop = 0;
    logout();
  };

  const recordScroll = () => {
    if (sidebarNavRef.current) {
      savedSidebarScrollTop = sidebarNavRef.current.scrollTop;
      try {
        sessionStorage.setItem("itsm_sidebar_scroll", String(savedSidebarScrollTop));
      } catch {}
    }
  };

  const handleSidebarScroll = (e: React.UIEvent<HTMLElement>) => {
    savedSidebarScrollTop = e.currentTarget.scrollTop;
    try {
      sessionStorage.setItem("itsm_sidebar_scroll", String(savedSidebarScrollTop));
    } catch {}
  };

  useEffect(() => {
    const nav = sidebarNavRef.current;
    if (!nav) return;

    const restore = () => {
      const saved = savedSidebarScrollTop || Number(sessionStorage.getItem("itsm_sidebar_scroll") || "0");
      if (saved > 0) {
        nav.scrollTop = saved;
      }

      const activeEl = nav.querySelector<HTMLElement>(".sidebar-item.active");
      if (activeEl) {
        const navRect = nav.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        // If active element is not visible within the sidebar viewport, scroll it into view
        if (activeRect.top < navRect.top || activeRect.bottom > navRect.bottom) {
          activeEl.scrollIntoView({ block: "center", behavior: "auto" });
          savedSidebarScrollTop = nav.scrollTop;
          try {
            sessionStorage.setItem("itsm_sidebar_scroll", String(savedSidebarScrollTop));
          } catch {}
        }
      }
    };

    restore();
    const raf = requestAnimationFrame(restore);
    const timer = setTimeout(restore, 50);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [path]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
        setSwitchOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
      if (globalOpen && !(event.target as Element).closest(".topbar-global-search")) {
        setGlobalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [globalOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#global-search-input")?.focus();
      }
      if (event.key === "Escape") setGlobalOpen(false);
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadApprovalHub(user.role === "END_USER").then((result) => {
      if (!active) return;
      setNotificationData(result);
      setNotificationError(result.errors.join(" "));
    }).catch((e) => {
      if (active) setNotificationError(e instanceof Error ? e.message : "Could not load notifications.");
    });
    return () => { active = false; };
  }, [user?.id, user?.role]);

  useEffect(() => {
    const q = globalQuery.trim();
    if (!user || q.length < 2) {
      setGlobalIncidents([]);
      setGlobalRequests([]);
      setGlobalKnowledge([]);
      setGlobalChanges([]);
      setGlobalLoading(false);
      return;
    }
    let active = true;
    setGlobalLoading(true);
    const timer = window.setTimeout(async () => {
      const needle = q.toLowerCase();
      const isEndUser = user.role === "END_USER";
      const isStaff = user.role !== "END_USER";
      try {
        const incidentsPromise = isEndUser
          ? incidentApi.myIncidents()
          : incidentApi.allIncidents(user.roles);
        const requestsPromise = isEndUser
          ? serviceRequestApi.mine()
          : user.role === "ADMIN"
            ? serviceRequestApi.all()
            : requestLifecycleApi.queue({ page: 1, pageSize: 25 });
        const knowledgePromise = isEndUser
          ? knowledgeApi.portalArticles(q)
          : knowledgeApi.articles({ q });
        const changesPromise = isStaff
          ? changeApi.list({ q })
          : Promise.resolve([] as Change[]);
        const [incidentResult, requestResult, knowledgeResult, changeResult] = await Promise.allSettled([
          incidentsPromise,
          requestsPromise,
          knowledgePromise,
          changesPromise,
        ]);

        if (!active) return;
        if (incidentResult.status === "fulfilled") {
          setGlobalIncidents(
            incidentResult.value.incidents
              .filter((item) => `${item.number} ${item.shortDescription} ${item.category ?? ""}`.toLowerCase().includes(needle))
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .slice(0, 4)
              .map((item) => ({
                id: item.id,
                code: item.number,
                title: item.shortDescription,
                href: isEndUser ? `/my-incidents/${item.id}` : `/incidents/${item.id}`,
              })),
          );
        }
        if (requestResult.status === "fulfilled") {
          const requestRows = Array.isArray(requestResult.value)
            ? requestResult.value
            : requestResult.value.items ?? [];
          setGlobalRequests(
            requestRows
              .filter((item) => `${item.requestNumber} ${item.catalog?.catalogName ?? ""} ${item.status}`.toLowerCase().includes(needle))
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 4)
              .map((item) => ({
                id: String(item.requestId),
                code: item.requestNumber ?? `SR${item.requestId}`,
                title: item.catalog?.catalogName ?? "Service Request",
                href: isEndUser ? `/service-requests/my-requests/${item.requestId}` : `/service-requests/queue/${item.requestId}`,
              })),
          );
        }
        if (knowledgeResult.status === "fulfilled") {
          setGlobalKnowledge(
            knowledgeResult.value.slice(0, 4).map((item) => ({
              id: String(item.articleId),
              code: item.articleCode,
              title: item.title,
              href: `/knowledge-base/${item.articleId}`,
            })),
          );
        }
        if (changeResult.status === "fulfilled") {
          setGlobalChanges(
            changeResult.value.slice(0, 4).map((item: Change) => ({
              id: String(item.changeId),
              code: item.changeCode,
              title: item.shortDescription,
              href: `/changes/${item.changeId}`,
            })),
          );
        }
      } finally {
        if (active) setGlobalLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [globalQuery, user?.id, user?.role, user?.roles]);

  const toggleSwitchPicker = async () => {
    if (switchOpen) {
      setSwitchOpen(false);
      return;
    }
    setSwitchOpen(true);
    setSwitchError("");
    if (switchUsers.length || switchLoading) return;
    setSwitchLoading(true);
    try {
      setSwitchUsers(await api.get<{ userId: number; fullName: string; email: string; roles: string[] }[]>("/users/switchable"));
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : "Could not load users.");
    } finally {
      setSwitchLoading(false);
    }
  };

  const startSupportSession = async () => {
    if (!supportTarget || switchStarting) return;
    setSwitchError("");
    setSwitchStarting(true);
    try {
      await switchUser(supportTarget.userId);
      setSupportTarget(null);
      setSwitchOpen(false);
      setUserMenuOpen(false);
      navigate("/");
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : "Could not switch users.");
    } finally {
      setSwitchStarting(false);
    }
  };

  useEffect(() => {
    if (!supportTarget) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !switchStarting) setSupportTarget(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [supportTarget, switchStarting]);

  const endSupportSession = async () => {
    setSwitchError("");
    try {
      await stopSwitching();
      setSwitchOpen(false);
      setUserMenuOpen(false);
      setSupportExpiryPrompt(false);
      navigate("/admin-dashboard");
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : "Could not end the support session.");
    }
  };

  const extendSupportSession = async () => {
    setSupportExtending(true);
    setSwitchError("");
    try {
      await extendSupportSessionFromAuth();
      setSupportExpiryPrompt(false);
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : "Could not extend the support session.");
    } finally {
      setSupportExtending(false);
    }
  };

  const toggleNotifications = async () => {
    const opening = !notificationOpen;
    setNotificationOpen(opening);
    if (!opening) return;
    setNotificationError("");
    setNotificationLoading(true);
    try {
      const result = await loadApprovalHub(user?.role === "END_USER");
      setNotificationData(result);
      if (result.errors.length) setNotificationError(result.errors.join(" "));
    } catch (e) {
      setNotificationError(e instanceof Error ? e.message : "Could not load notifications.");
    } finally {
      setNotificationLoading(false);
    }
  };

  const clearNotifications = () => {
    const next = Array.from(new Set([
      ...clearedNotificationIds,
      ...pendingNotifications.map((item) => item.id),
    ]));
    setClearedNotificationIds(next);
    if (notificationStorageKey) {
      try {
        localStorage.setItem(notificationStorageKey, JSON.stringify(next));
      } catch {}
    }
  };

  // Every menu path, filled in below. A parent such as /service-requests must not light up while a more specific
  // item (/service-requests/my-requests) is the page being shown, so only the longest matching path is active.
  let menuPaths: string[] = [];
  const isActive = (to: string) => {
    if (!(path === to || path.startsWith(to + "/"))) return false;
    return !menuPaths.some((other) => other.length > to.length && (path === other || path.startsWith(other + "/")));
  };

  // Role > Navigation Access (when an admin has configured it) decides what a non-admin sees.
  const access = useAsync(() => api.get<{ configured: boolean; items: { navKey: string; visible: boolean; canCreate: boolean }[] }>("/navigation/me").catch(() => ({ configured: false, items: [] })), [user?.role]);
  const isAdmin = user?.role === "ADMIN";
  const allowed = access.data?.configured ? new Set(access.data.items.filter((i) => i.visible).map((i) => i.navKey)) : null;
  const ownDashboard = isAdmin ? "/admin-dashboard" : user?.role === "RESOLVER" ? "/resolver-dashboard" : "/my-dashboard";
  // Non-admin custom roles get a menu built from the ticked items across all screens when configured.
  // Admins always retain full configuration and admin panel access.
  const fromTicked = allowed && !isAdmin ? buildNavFromAllowed(allowed, [ownDashboard]) : null;
  const { flatSections: baseFlatSections, configGroup: baseConfigGroup } = fromTicked ?? buildNav(user?.role);
  const keep = (it: NavigationItem) => !allowed || isAdmin || !it.to.startsWith("/") || allowed.has(it.to) || it.to === ownDashboard;
  const flatSections: FlatSection[] = baseFlatSections.map((sec) => ({ ...sec, items: sec.items.filter(keep) })).filter((sec) => sec.items.length > 0);
  const configGroup: CollapsibleGroup | null = baseConfigGroup
    ? { ...baseConfigGroup, subgroups: baseConfigGroup.subgroups.map((g) => ({ ...g, items: g.items.filter(keep) })).filter((g) => g.items.length > 0) }
    : null;

  menuPaths = [...flatSections.flatMap((s) => s.items.map((i) => i.to)), ...(configGroup ? configGroup.subgroups.flatMap((g) => g.items.map((i) => i.to)) : [])].filter((t) => t.startsWith("/"));

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
        {user && (
          <div className="topbar-global-search">
            <Search aria-hidden="true" size={16} />
            <input
              id="global-search-input"
              type="search"
              role="searchbox"
              aria-label="Global search"
              placeholder="Search for Service Requests, Incidents, Knowledge…"
              value={globalQuery}
              onFocus={() => setGlobalOpen(true)}
              onChange={(event) => {
                setGlobalQuery(event.target.value);
                setGlobalOpen(true);
              }}
            />
            {globalQuery ? (
              <button type="button" aria-label="Clear global search" onClick={() => { setGlobalQuery(""); setGlobalOpen(false); }}><X size={14} /></button>
            ) : (
              <span className="global-search-shortcut">Ctrl + K</span>
            )}
            {globalOpen && globalQuery.trim().length >= 2 && (
              <div className="global-search-popover" role="dialog" aria-label="Global search results">
                <div className="global-search-tabs">
                  <button type="button" className="active">All ({globalIncidents.length + globalRequests.length + globalKnowledge.length + globalChanges.length})</button>
                  <button type="button" onClick={() => navigate(user.role === "END_USER" ? "/my-incidents" : "/incidents")}>Incidents ({globalIncidents.length})</button>
                  <button type="button" onClick={() => navigate(user.role === "END_USER" ? "/service-requests/my-requests" : user.role === "ADMIN" ? "/admin/requests" : "/service-requests/queue")}>Service Requests ({globalRequests.length})</button>
                  <button type="button" onClick={() => navigate(user.role === "END_USER" ? "/knowledge-base" : "/knowledge")}>Knowledge ({globalKnowledge.length})</button>
                  {user.role !== "END_USER" && (
                    <button type="button" onClick={() => navigate("/changes")}>Changes ({globalChanges.length})</button>
                  )}
                </div>
                {globalLoading ? (
                  <div className="global-search-empty">Searching…</div>
                ) : (
                  <>
                    {globalRequests.length > 0 && (
                      <section className="global-search-section">
                        <div className="global-search-section-heading">
                          <span>Service Requests ({globalRequests.length})</span>
                          <button type="button" onClick={() => navigate(user.role === "END_USER" ? "/service-requests/my-requests" : "/service-requests")}>View All →</button>
                        </div>
                        {globalRequests.map((item) => (
                          <Link key={item.id} to={item.href} className="global-search-item" onClick={() => setGlobalOpen(false)}>
                            <span className="global-search-item-icon">SR</span>
                            <span><strong>{item.code} – {item.title}</strong><small>Service Request</small></span>
                          </Link>
                        ))}
                      </section>
                    )}
                    {globalIncidents.length > 0 && (
                      <section className="global-search-section">
                        <div className="global-search-section-heading">
                          <span>Incidents ({globalIncidents.length})</span>
                          <button type="button" onClick={() => navigate(user.role === "END_USER" ? "/my-incidents" : "/incidents")}>View All →</button>
                        </div>
                        {globalIncidents.map((item) => (
                          <Link key={item.id} to={item.href} className="global-search-item" onClick={() => setGlobalOpen(false)}>
                            <span className="global-search-item-icon incident">INC</span>
                            <span><strong>{item.code} – {item.title}</strong><small>Incident</small></span>
                          </Link>
                        ))}
                      </section>
                    )}
                    {globalKnowledge.length > 0 && (
                      <section className="global-search-section">
                        <div className="global-search-section-heading">
                          <span>Knowledge ({globalKnowledge.length})</span>
                          <button type="button" onClick={() => navigate("/knowledge-base")}>View All →</button>
                        </div>
                        {globalKnowledge.map((item) => (
                          <Link key={item.id} to={item.href} className="global-search-item" onClick={() => setGlobalOpen(false)}>
                            <span className="global-search-item-icon knowledge">KB</span>
                            <span><strong>{item.code} – {item.title}</strong><small>Knowledge article</small></span>
                          </Link>
                        ))}
                      </section>
                    )}
                    {globalChanges.length > 0 && (
                      <section className="global-search-section">
                        <div className="global-search-section-heading">
                          <span>Changes ({globalChanges.length})</span>
                          <button type="button" onClick={() => navigate("/changes")}>View All →</button>
                        </div>
                        {globalChanges.map((item) => (
                          <Link key={item.id} to={item.href} className="global-search-item" onClick={() => setGlobalOpen(false)}>
                            <span className="global-search-item-icon change">CHG</span>
                            <span><strong>{item.code} – {item.title}</strong><small>Change</small></span>
                          </Link>
                        ))}
                      </section>
                    )}
                    {globalIncidents.length + globalRequests.length + globalKnowledge.length + globalChanges.length === 0 && (
                      <div className="global-search-empty">No records found for “{globalQuery.trim()}”.</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <div className="topbar-right">
          {user && (
            <>
              <div className="topbar-notifications" ref={notificationRef}>
                <button aria-label="Notifications" aria-expanded={notificationOpen} onClick={() => void toggleNotifications()}>
                  <Bell aria-hidden="true" size={16} />
                  {visibleNotifications.length > 0 && <span className="topbar-notification-dot" />}
                </button>
                {notificationOpen && (
                  <div className="notification-popover" role="dialog" aria-label="Notifications">
                    <div className="notification-popover-heading">
                      <strong>Notifications ({visibleNotifications.length})</strong>
                      <div className="notification-popover-actions">
                        <button className="notification-popover-clear" type="button" onClick={clearNotifications} disabled={!visibleNotifications.length}>
                          Clear all
                        </button>
                        <button type="button" onClick={() => setNotificationOpen(false)} aria-label="Close notifications"><X size={15} /></button>
                      </div>
                    </div>
                    <div className="notification-popover-tabs"><span>Approvals</span></div>
                    {notificationError && <div className="notification-popover-error">{notificationError}</div>}
                    {notificationLoading && !notificationData ? <div className="notification-popover-empty">Loading…</div>
                      : visibleNotifications.slice(0, 5).map((item: ApprovalHubItem) => (
                        <Link className="notification-popover-item" key={item.id} to={item.href} onClick={() => setNotificationOpen(false)}>
                          <span className="notification-dot" aria-hidden="true" />
                          <span><strong>{item.module} approval: <u>{item.reference}</u></strong><small>{item.title}</small><small>{item.requestedBy}</small></span>
                        </Link>
                      ))}
                    {!notificationLoading && visibleNotifications.length === 0 && !notificationError &&
                      <div className="notification-popover-empty">
                        {pendingNotifications.length
                          ? "Notifications cleared. Pending approvals remain in My Approvals."
                          : "No pending approvals."}
                      </div>}
                    <Link className="notification-popover-all" to="/notifications" onClick={() => setNotificationOpen(false)}>View all notifications <span aria-hidden="true">↗</span></Link>
                  </div>
                )}
              </div>
              <div className="topbar-user-wrapper" ref={userMenuRef}>
                <button
                  className="topbar-user"
                  aria-label="User menu"
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((open) => !open)}
                >
                  {user.profilePhotoUrl
                    ? <img className="topbar-user-photo" src={assetUrl(user.profilePhotoUrl)} alt="" />
                    : initialsOf(user.name)}
                </button>
                {userMenuOpen && (
                  <div className={`user-dropdown ${switchOpen ? "switch-user-open" : ""}`} role="menu">
                    <div className="user-dropdown-info">
                      <div className="user-dropdown-name">{user.name}</div>
                      <div className="user-dropdown-role">{user.role}</div>
                    </div>
                    <div className="user-dropdown-divider" />
                    <Link
                      className="user-dropdown-profile"
                      role="menuitem"
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <UserRound size={14} aria-hidden="true" />
                      My profile
                    </Link>
                    {user.actingAs ? (
                      <button className="user-dropdown-switch" role="menuitem" onClick={() => void endSupportSession()}>
                        End support session
                      </button>
                    ) : user.role === "ADMIN" ? (
                      <button className="user-dropdown-switch" role="menuitem" aria-expanded={switchOpen} onClick={() => void toggleSwitchPicker()}>
                        <UserRound size={14} aria-hidden="true" />
                        Switch user
                        <span aria-hidden="true">{switchOpen ? "⌃" : "⌄"}</span>
                      </button>
                    ) : null}
                    {switchOpen && !user.actingAs && (
                      <div className="switch-user-panel">
                        <label htmlFor="switch-user-search">Search and switch to another user</label>
                        <input id="switch-user-search" type="search" placeholder="Name or email…" value={switchSearch} onChange={(e) => setSwitchSearch(e.target.value)} />
                        {switchError && <div className="switch-user-error">{switchError}</div>}
                        <div className="switch-user-list">
                          {switchLoading ? <div className="switch-user-empty">Loading users…</div>
                            : switchUsers.filter((item) => `${item.fullName} ${item.email}`.toLowerCase().includes(switchSearch.trim().toLowerCase())).map((item) => (
                              <button type="button" key={item.userId} disabled={String(item.userId) === user.id} onClick={() => { setSwitchError(""); setSupportTarget(item); }}>
                                <span className="switch-user-avatar">{initialsOf(item.fullName)}</span>
                                <span><strong>{item.fullName}</strong><small>{item.email}</small></span>
                              </button>
                            ))}
                          {!switchLoading && switchUsers.length === 0 && !switchError && <div className="switch-user-empty">No active users found.</div>}
                        </div>
                      </div>
                    )}
                    <button
                      className="user-dropdown-logout"
                      role="menuitem"
                      onClick={() => { setUserMenuOpen(false); handleLogout(); }}
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
      {user?.actingAs && (
        <div className="support-session-banner" role="status">
          You are viewing the app as <strong>{user.name}</strong>. Support session opened by {user.actingAs.fullName}.
          {supportSecondsLeft !== null && (
            <span className={`support-session-countdown ${supportSecondsLeft <= 300 ? "support-session-countdown-warning" : ""}`}>
              Time left <strong>{formatCountdown(supportSecondsLeft)}</strong>
            </span>
          )}
          <button type="button" onClick={() => void endSupportSession()}>Return to administrator</button>
        </div>
      )}
      {supportTarget && (
        <div
          className="support-session-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !switchStarting) setSupportTarget(null);
          }}
        >
          <section className="support-session-dialog" role="dialog" aria-modal="true" aria-labelledby="support-session-dialog-title">
            <div className="support-session-dialog-heading">
              <span className="support-session-dialog-icon"><UserRound size={18} aria-hidden="true" /></span>
              <div>
                <span>Switch user</span>
                <h2 id="support-session-dialog-title">Start support session?</h2>
              </div>
              <button type="button" aria-label="Close" disabled={switchStarting} onClick={() => setSupportTarget(null)}><X size={17} /></button>
            </div>
            <p className="support-session-dialog-copy">
              You will temporarily access the app as <strong>{supportTarget.fullName}</strong>. This session is audited and expires after 30 minutes.
            </p>
            {switchError && <div className="support-session-dialog-error" role="alert">{switchError}</div>}
            <div className="support-session-dialog-actions">
              <button className="btn-ghost" type="button" disabled={switchStarting} autoFocus onClick={() => setSupportTarget(null)}>Cancel</button>
              <button className="btn-primary" type="button" disabled={switchStarting} onClick={() => void startSupportSession()}>
                {switchStarting ? "Starting…" : "Start support session"}
              </button>
            </div>
          </section>
        </div>
      )}
      {supportExpiryPrompt && user?.actingAs && (
        <div className="support-session-dialog-backdrop">
          <section className="support-session-dialog" role="dialog" aria-modal="true" aria-labelledby="support-expiry-dialog-title">
            <div className="support-session-dialog-heading">
              <span className="support-session-dialog-icon"><Bell size={18} aria-hidden="true" /></span>
              <div>
                <span>Support session</span>
                <h2 id="support-expiry-dialog-title">
                  {supportSecondsLeft === 0 ? "Session expired" : "Continue this support session?"}
                </h2>
              </div>
              <button type="button" aria-label="Close" disabled={supportExtending} onClick={() => setSupportExpiryPrompt(false)}><X size={17} /></button>
            </div>
            <p className="support-session-dialog-copy">
              The session for <strong>{user.name}</strong> {supportSecondsLeft === 0 ? "has ended" : `has ${formatCountdown(supportSecondsLeft ?? 0)} remaining`}.
              Continue access for another 30 minutes or return to the administrator.
            </p>
            {switchError && <div className="support-session-dialog-error" role="alert">{switchError}</div>}
            <div className="support-session-dialog-actions">
              <button className="btn-ghost" type="button" disabled={supportExtending} onClick={() => void endSupportSession()}>
                Return to administrator
              </button>
              <button className="btn-primary" type="button" disabled={supportExtending} onClick={() => void extendSupportSession()}>
                {supportExtending ? "Extending…" : "Continue 30 minutes"}
              </button>
            </div>
          </section>
        </div>
      )}

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
            <nav
              className="sidebar-nav"
              aria-label="Application navigation"
              ref={sidebarNavRef}
              onScroll={handleSidebarScroll}
            >
              {/* Flat sections: role-specific workspace navigation */}
              {filteredFlatSections.map((section) => (
                <section className={`sidebar-section ${user.role === "RESOLVER" ? "analyst-sidebar-section" : ""}`} key={section.title}>
                  <div className="sidebar-section-heading">{section.title}</div>
                  {section.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={recordScroll}
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
                    onClick={() => {
                      recordScroll();
                      setExpandedGroups((current) => ({
                        ...current,
                        CONFIGURATION: !(current["CONFIGURATION"] ?? true),
                      }));
                    }}
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
                              onClick={recordScroll}
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
                  <button type="button" className="sidebar-logout" onClick={handleLogout}>
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
