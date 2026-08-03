# Live Demo Guide — ITSM Incident Management System

*A presenter's script and technical reference for demoing this project confidently to a client or interviewer.*

---

## 1. The 10–15 Minute Demo Script

Use this as a loose script — read the *intent* of each line, not the words verbatim.

### Opening (1 min)

> "What I'm showing you today is a pixel-perfect, production-structured front end for an Incident Management System — the kind of internal tool IT teams use to log, track, and resolve issues. It's built with Next.js 15, TypeScript, and Tailwind CSS, and every screen matches the approved design spec exactly. Right now it runs on mock data, so there's no backend dependency — but I built it so a real API can be dropped in without touching a single page component."

### 1. Login (1 min)

- Open `/login`.
- Point out: username/password fields with icons, show/hide password toggle, "Remember me," validation on empty submit, loading state on the button.
- *Say:* "This is a fully controlled form — try submitting empty and you'll see inline validation. The login button shows a spinner state, which is exactly how it'll behave once wired to a real auth endpoint."

### 2. Home Dashboard (2–3 min)

- Log in → lands on `/home`.
- Point out: greeting with the user's name, global search bar, 4 quick-action tiles, Recent Incidents table with pagination, Announcements panel, Knowledge Base panel, Quick Links row.
- *Say:* "Everything here is data-driven — the incidents table, the announcements, the KB articles — all pulled from typed mock data files. Swapping this for live data is a one-line change per page, which I'll show later."
- Resize the browser to show responsiveness — sidebar collapses into a hamburger menu below tablet width.

### 3. Create Incident (2 min)

- Navigate to Create Incident.
- Fill a few fields, show the category → sub-category dependency (changing Category updates the Sub Category list).
- Drag a file onto the attachment zone (or click to browse).
- Submit → show the loading state → success confirmation → redirect.
- *Say:* "Validation runs client-side against required fields, and file uploads are validated for type and size — 10MB max, jpg/png/pdf/docx only, matching the spec exactly."

### 4. My Incidents (2 min)

- Navigate to My Incidents.
- Use the search box, then the Status and Priority filters together — show the list narrowing live.
- Click through pagination.
- Click an Incident ID link to jump to the Detail screen.
- *Say:* "This table is fully reusable — the same `IncidentTable` component powers both this screen and the Recent Incidents widget on the dashboard, just configured with different columns and page sizes."

### 5. Incident Detail (2–3 min)

- Show the collapsible Incident Details card (click the chevron to collapse/expand).
- Point out the Timeline (visual event history), the Conversation panel (type a message and send it — it appends live), and the SLA Information card with the progress bar.
- Click "Request Update" and "Reopen" to show the confirmation modals.
- *Say:* "Every one of these — the timeline, the conversation thread, the SLA bar — is its own component, so if the client wants to reuse the conversation thread inside a Service Request screen later, it's a drop-in import."

### Responsiveness Close (1 min)

- Shrink the browser to mobile width, or open dev tools device toolbar.
- Show the hamburger menu opening the sidebar as a slide-over drawer with a backdrop.
- *Say:* "Every screen — not just the dashboard — was built mobile-first and tested at phone, tablet, and desktop breakpoints."

### Closing (1 min)

> "To summarize: five pixel-accurate screens, a fully reusable component library, strict TypeScript throughout, and a folder structure that mirrors how you'd organize a production app. The only thing separating this from a live product is swapping the mock data layer for real API calls — and I designed the data layer specifically to make that swap painless."

---

## 2. Folder Structure Walkthrough — and Why

Open the file tree and explain top-down:

- **`src/app/`** — Next.js App Router. Every folder is a URL route. The `(dashboard)` folder is a *route group* — parentheses mean it doesn't add a URL segment, but every page inside automatically gets wrapped in the shared Navbar + Sidebar layout. This is why `/home`, `/incidents`, `/profile` all look consistent without repeating layout code.
- **`src/components/ui/`** — Generic, reusable primitives (Button, Input, Table, Dialog…). These know nothing about "incidents" or "ITSM" — they could be dropped into any project. This mirrors the shadcn/ui philosophy: own your components instead of importing a black-box library.
- **`src/components/layout/`** — Structural, app-wide pieces: Navbar, Sidebar, Breadcrumb. There's exactly one Navbar and one Sidebar instance for the whole app, not one per page.
- **`src/components/incidents/`** and **`dashboard/`** — Domain-specific components. This is the layer that *does* know about incidents, SLAs, timelines. Separating domain components from generic UI primitives is what makes the primitives reusable across future features (Service Requests, Approvals, etc.).
- **`src/data/`** — The mock data layer, standing in for a backend. Every file exports either static arrays or a function (e.g., `getIncidentById`) — the function pattern is what makes swapping in a real fetch call trivial later.
- **`src/types/`** — Shared TypeScript interfaces. Defining `Incident`, `IncidentStatus`, `TimelineEvent` etc. once means every component that touches incident data gets full autocomplete and compile-time safety.
- **`src/lib/utils.ts`** — Just the `cn()` helper (merges Tailwind classes safely). Small, but used in almost every component file.

**Talking point if asked "why this structure?":** *"It scales. When this app grows to 50 screens, `components/ui` stays generic and reusable, `components/{domain}` grows one folder per feature, and nothing becomes a 3,000-line file."*

---

## 3. Reusable Components & Design Decisions

| Decision | Why |
|---|---|
| Native `<select>` styled with Tailwind, not a custom listbox | Keeps full keyboard/screen-reader support and correct mobile behavior for free — a custom dropdown would need to reimplement all of that. |
| `IncidentTable` takes `showAssignmentGroup` and `dateLabel` props | One component serves both the 5-row dashboard widget and the 28-row full list — no duplicated table markup. |
| `StatusBadge` / `PriorityBadge` map an enum to a color | Status colors are defined in exactly one place (`status-badge.tsx`). Change "Resolved" from green to teal once, and it updates everywhere. |
| `class-variance-authority` (CVA) on Button/Badge | Gives type-safe variants (`variant="destructive"`, `size="sm"`) instead of scattering conditional class strings through the codebase. |
| Radix UI primitives under the hood (Dialog, DropdownMenu, Checkbox, Avatar) | Radix handles focus trapping, ESC-to-close, ARIA roles, and portal rendering correctly — accessibility that's very easy to get wrong by hand. |
| Mock data as typed functions (`getIncidentById(id)`), not just arrays | The call-site code (`const incident = getIncidentById(id)`) doesn't change when this becomes `await fetch(...)` — only the function body does. |
| `cn()` utility everywhere | Prevents Tailwind class conflicts (e.g., two `px-*` classes fighting) by merging intelligently rather than just concatenating strings. |

**If asked "why not shadcn/ui's CLI directly?"** — *"The components here follow the exact same pattern shadcn/ui generates — same Radix primitives, same CVA variant system, same file-per-component structure — they're hand-built the same way the CLI would scaffold them, so the outcome is identical, just without a dependency on network access to their registry."*

---

## 4. How Routing Works (Next.js App Router)

- **File-based routing:** a `page.tsx` inside `src/app/incidents/create/` automatically becomes the route `/incidents/create`. No route config file to maintain.
- **Route groups `(dashboard)`:** the parentheses tell Next.js "wrap everything inside in this layout, but don't add a URL segment." That's how `/home` and `/incidents` share one Navbar/Sidebar without `/dashboard/home`.
- **Dynamic segments `[id]`:** `src/app/(dashboard)/incidents/[id]/page.tsx` matches `/incidents/INC000125`, `/incidents/INC000124`, etc. The `id` is read via the `params` prop.
- **`generateStaticParams`:** on the detail page, this pre-computes every known incident ID at build time so each incident detail page can be statically generated (fast, SEO-friendly) rather than rendered on every request.
- **Layouts nest automatically:** `src/app/layout.tsx` (root HTML shell) wraps `src/app/(dashboard)/layout.tsx` (Navbar/Sidebar) wraps each `page.tsx`. Only the innermost part re-renders on navigation — the Navbar and Sidebar don't remount between pages.
- **Server vs. Client Components:** pages are Server Components by default (faster, no JS shipped for static parts). Any component using state, effects, or browser events (`"use client"` at the top, e.g. the login form, the incident form, the sidebar drawer) opts into the client bundle explicitly.

---

## 5. How Responsiveness Was Implemented

- **Mobile-first Tailwind breakpoints:** base classes target mobile; `sm:`, `md:`, `lg:` prefixes progressively enhance the layout for larger screens (e.g., `grid-cols-2 sm:grid-cols-4` on the dashboard's quick-action tiles).
- **Sidebar becomes a drawer below `md` (768px):** on desktop it's a static `<aside>` in the flex layout; on mobile the same nav links render inside a fixed, animated slide-over panel with a backdrop, triggered by a hamburger button in the Navbar.
- **Tables scroll horizontally, not off-screen:** every `<Table>` is wrapped in `overflow-x-auto`, so wide data tables (My Incidents has 6 columns) become swipeable on narrow screens instead of breaking the layout.
- **Grid column counts collapse progressively:** e.g., the Incident Detail page is `grid-cols-1 lg:grid-cols-3` — a single stacked column on mobile/tablet, and a 2/3 + 1/3 split only at desktop width.
- **Touch-friendly targets:** buttons and inputs are `h-10`/`h-11` (40–44px) minimum, meeting standard touch-target guidance.
- **Tested at three breakpoints during build:** 390px (mobile), 820px (tablet), 1280px (desktop) — screenshots were taken at each to visually verify no overlap or overflow.

---

## 6. Mock Data — And How It Becomes Real

All mock data lives in `src/data/*.ts`, typed against interfaces in `src/types/`. Nothing is hardcoded inside components or pages — every page imports data from `src/data/`.

**Today (mock):**
```ts
import { incidentListItems } from '@/data/incidents';
const items = incidentListItems; // static array
```

**Tomorrow (real API), same call site:**
```ts
import { getIncidentList } from '@/data/incidents';
const items = await getIncidentList(); // fetch() under the hood
```

Because Server Components can be `async` natively in the App Router, most pages won't need any extra state-management library just to fetch data — `await` inside the page component is enough. Client-side interactive pieces (search-as-you-type, filters, the message composer) already use local React state and can be pointed at API routes or a library like SWR/React Query with minimal changes.

**Suggested migration path when a backend is ready:**
1. Stand up REST or GraphQL endpoints mirroring the shapes in `src/types/incident.ts`.
2. Replace each exported constant in `src/data/*.ts` with an exported `async` function that calls `fetch()`.
3. Add `await` at each call site (Server Components) or wrap in `useEffect`/React Query (Client Components).
4. Nothing in `src/components/` needs to change — they only consume props, never import `src/data/` directly.

---

## 7. Common Interview / Client Questions — Concise Answers

**Q: Why Next.js instead of plain React?**
A: File-based routing, built-in Server Components for faster initial loads, image/font optimization, and a clear path to adding API routes or server actions later without switching frameworks.

**Q: Why Tailwind CSS instead of plain CSS or styled-components?**
A: Co-locates styling with markup (faster iteration, no separate CSS files to keep in sync), produces a small production bundle (unused classes are purged), and made it straightforward to encode the exact design tokens (colors, spacing) from the spec as reusable utility classes.

**Q: Why build custom components instead of a component library like MUI or Ant Design?**
A: Full control over pixel-perfect matching to the design spec — off-the-shelf libraries fight you on exact spacing/color. It also keeps the bundle smaller (no unused library code) and avoids the visual "this is obviously MUI" tell.

**Q: Why TypeScript?**
A: Compile-time safety — if a component expects an `Incident` and you pass a `string`, it fails at build time, not in front of a user. It also gives free autocomplete across a 40+ component codebase.

**Q: How would you integrate a real backend?**
A: See Section 6. In short: the mock data layer already sits behind a function-based interface, so swapping static arrays for `fetch()` calls doesn't touch any component code.

**Q: Is this accessible?**
A: Semantic HTML throughout (`<nav>`, `<main>`, `<header>`), ARIA labels on icon-only buttons, visible focus rings, Radix primitives for correct modal/dropdown keyboard behavior, and `prefers-reduced-motion` support.

**Q: How would you add authentication?**
A: The login form already isolates its submit handler in one place (`handleSubmit` in `login/page.tsx`). Swap the mock `setTimeout` for a real call to an auth provider (NextAuth.js, Clerk, or a custom JWT endpoint), and gate the `(dashboard)` route group with middleware that redirects unauthenticated users back to `/login`.

**Q: How would you test this?**
A: Component-level tests with React Testing Library + Vitest/Jest for things like form validation and filter logic; Playwright/Cypress for end-to-end flows (login → create incident → see it in the list).

**Q: What would you change for production?**
A: Add a real backend/auth, add error boundaries and loading skeletons for network states, add environment-based configuration, and add automated tests and CI.

---

## 8. Tips for Presenting Confidently

- **Drive from the browser, not the code editor, for the first pass.** Show the product working end-to-end before diving into files — clients care about the experience first.
- **Narrate what you clicked, not what you're about to click.** "Here I'm filtering by High priority" reads more confident than "now let me show you the filter."
- **Resize the window live at least once.** Responsiveness is hard to appreciate from static screenshots — showing the sidebar collapse into a drawer in real time is a strong, memorable beat.
- **If something looks slightly off, name it calmly and move on.** "This is running against mock data, so the numbers won't always add up perfectly — with a live API this reconciles automatically." Confidence is about handling a discrepancy smoothly, not pretending it doesn't exist.
- **Have the code open in a second tab, ready — not open by default.** Only jump into `IncidentTable.tsx` or similar when a technical question invites it; don't lead with code to a non-technical stakeholder.
- **Anticipate the "can it do X" question by knowing what's mock vs. real.** Be ready to say plainly: "That's mocked today; here's exactly how it would connect to a real endpoint" — see Section 6 for the answer.
- **Close with the folder structure, not the login screen.** Ending on "and here's how it's organized to grow" leaves a technical stakeholder with confidence in the codebase, not just the pixels.
