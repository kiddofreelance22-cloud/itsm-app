# ITSM — Incident Management System

A pixel-perfect, fully responsive **Next.js 15** implementation of the ITSM Incident Management System UI, built from the provided screen-flow reference document.

---

## Live Demo Quick-Start

```bash
npm install
npm run dev
```

Open [http://50.6.45.238:3000](http://50.6.45.238:3000) and you will be redirected to the Login page automatically.

**Demo credentials:** any non-empty username + password will log you in (mock authentication).

---

## Screens Implemented

| # | Route | Description |
|---|-------|-------------|
| 1 | `/login` | Sign-in card with animated wave background, show/hide password, remember me |
| 2 | `/home` | Dashboard — search, quick actions, recent incidents table, announcements, KB panel, quick links |
| 3 | `/incidents/create` | Create Incident form — all fields, drag-drop file upload, validation, submit feedback |
| 4 | `/incidents` | My Incidents — filterable, sortable, paginated table (28 rows across 3 pages) |
| 5 | `/incidents/[id]` | Incident Detail — expandable details card, SLA panel, timeline, conversation, related items |
| + | `/knowledge-base` | Knowledge Base article list |
| + | `/service-requests` | Service catalog |
| + | `/approvals` | Pending approvals |
| + | `/profile` | User profile card |
| + | `/notifications` | Notification list |

---

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 15.x (App Router) | Framework & routing |
| React | 19 | UI library |
| TypeScript | 5.x (strict) | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| Radix UI | latest | Accessible primitives |
| Lucide React | 0.383 | Icon set |
| class-variance-authority | latest | Component variant system |
| clsx + tailwind-merge | latest | Conditional class merging |

---

## Folder Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── (dashboard)/              # Route group — shares DashboardLayout
│   │   ├── layout.tsx            # Navbar + Sidebar shell
│   │   ├── home/page.tsx         # Screen 2 — Dashboard
│   │   ├── incidents/
│   │   │   ├── page.tsx          # Screen 4 — My Incidents list
│   │   │   ├── create/page.tsx   # Screen 3 — Create Incident
│   │   │   └── [id]/page.tsx     # Screen 5 — Incident Detail
│   │   ├── knowledge-base/page.tsx
│   │   ├── service-requests/page.tsx
│   │   ├── approvals/page.tsx
│   │   ├── profile/page.tsx
│   │   └── notifications/page.tsx
│   ├── login/page.tsx            # Screen 1 — Login
│   ├── globals.css               # Tailwind base + brand CSS variables
│   ├── layout.tsx                # Root HTML shell
│   ├── page.tsx                  # Root "/" → redirect to /login
│   └── not-found.tsx             # 404 page
│
├── components/
│   ├── ui/                       # Generic, brand-agnostic primitives
│   │   ├── button.tsx            # CVA-powered variant button
│   │   ├── input.tsx             # Leading/trailing icon input
│   │   ├── textarea.tsx
│   │   ├── select.tsx            # Styled native select + ChevronDown
│   │   ├── badge.tsx             # Status/priority color chips
│   │   ├── checkbox.tsx          # Radix Checkbox
│   │   ├── avatar.tsx            # Radix Avatar
│   │   ├── card.tsx              # Card / CardHeader / CardContent
│   │   ├── dialog.tsx            # Radix Dialog modal
│   │   ├── dropdown-menu.tsx     # Radix DropdownMenu
│   │   ├── label.tsx             # Radix Label
│   │   ├── progress.tsx          # Radix Progress bar
│   │   ├── separator.tsx         # Radix Separator
│   │   ├── table.tsx             # Semantic table wrappers
│   │   └── pagination.tsx        # Page-number navigator
│   │
│   ├── layout/                   # App-level structural components
│   │   ├── navbar.tsx            # Top navigation bar
│   │   ├── sidebar.tsx           # Desktop sidebar + mobile drawer
│   │   ├── breadcrumb.tsx        # Breadcrumb trail
│   │   └── nav-items.ts          # Shared navigation config
│   │
│   ├── incidents/                # Incident domain components
│   │   ├── incident-table.tsx    # Reusable incident rows table
│   │   ├── incident-form.tsx     # Full create-incident form
│   │   ├── incident-details-card.tsx  # Collapsible detail card
│   │   ├── incident-header-actions.tsx # Edit / Request Update / Reopen
│   │   ├── status-badge.tsx      # StatusBadge — maps status → color
│   │   ├── priority-badge.tsx    # PriorityBadge — dot + label
│   │   ├── timeline.tsx          # Event timeline component
│   │   ├── conversation-panel.tsx # Message thread + reply
│   │   ├── sla-info-card.tsx     # SLA targets + progress bar
│   │   └── related-items-card.tsx
│   │
│   └── dashboard/                # Dashboard-specific display widgets
│       ├── quick-action-card.tsx
│       ├── announcements-panel.tsx
│       ├── knowledge-base-panel.tsx
│       └── quick-links.tsx
│
├── data/                         # Mock JSON / TS data (replaces a real API)
│   ├── incidents.ts              # 28 incidents + full detail for each
│   ├── content.ts                # Announcements + KB articles
│   ├── form-options.ts           # Dropdown option lists
│   └── user.ts                   # Current user object
│
├── types/                        # TypeScript interfaces & union types
│   ├── incident.ts               # Incident, IncidentListItem, Timeline…
│   └── index.ts                  # User, Announcement, KnowledgeArticle…
│
└── lib/
    └── utils.ts                  # cn() — clsx + tailwind-merge helper
```

---

## Installation

```bash
# 1. Clone / unzip the project
cd itsm-app

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
# → http://50.6.45.238:3000

# 4. Build for production
npm run build
npm run start
```

Node.js ≥ 18 is required.

---

## Replacing Mock Data with a Real API

Every data-fetching call is isolated in `src/data/`. To wire up a backend:

```ts
// src/data/incidents.ts  — BEFORE (mock)
export const incidentListItems: IncidentListItem[] = [ /* hardcoded */ ];

// src/data/incidents.ts  — AFTER (API)
export async function getIncidentList(): Promise<IncidentListItem[]> {
  const res = await fetch('/api/incidents', { cache: 'no-store' });
  return res.json();
}
```

Page components would change from:

```tsx
// page.tsx — mock
import { incidentListItems } from '@/data/incidents';
const items = incidentListItems;
```

to:

```tsx
// page.tsx — live API
import { getIncidentList } from '@/data/incidents';
const items = await getIncidentList();  // works in Server Components natively
```

Client components that need real-time updates can use `useEffect` + `fetch`, SWR, or React Query — the component interfaces stay unchanged.

---

## Environment Variables (when adding a backend)

Create `.env.local` (already in `.gitignore`):

```env
NEXT_PUBLIC_API_URL=https://api.youritsm.com
AUTH_SECRET=your-secret-here
```

---

## Accessibility

- All interactive elements have visible `:focus-visible` ring (2 px brand blue).
- `aria-label`, `aria-current="page"`, `aria-expanded`, `aria-invalid`, `aria-busy` are set throughout.
- Sidebar drawer uses `role="dialog"` + `aria-modal="true"` on mobile.
- `@media (prefers-reduced-motion)` disables transitions.
- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<aside>`, `<ol>` for timeline, `<ul>` for file lists.
- Form validation surfaces errors with `role="alert"` paragraphs.

---

## Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| `< 768px` (mobile) | Single-column, hamburger menu → slide-over drawer |
| `768px–1024px` (tablet) | Static sidebar, single-column main content |
| `≥ 1024px` (desktop) | Sidebar + 2/3-1/3 or 3-column main grid |

---

## Scripts

```bash
npm run dev      # Development server (hot reload)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint check
npx tsc --noEmit # TypeScript type check only
```
