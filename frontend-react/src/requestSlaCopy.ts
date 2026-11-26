/**
 * The prototype's wording for the three SLA pages, ready to plug in.
 *
 * Urgency, Priority and SLA Service Window are shared with the incident module, and the screens that
 * render them (MasterListPage.tsx, ServiceWindowAndRoles.tsx) were not in the files I received, so these are
 * NOT wired in. Pass `REQUEST_SLA_COPY.urgency` (etc.) to those screens from request-only routes and keep
 * the incident routes on their current wording; the incident pages stay untouched.
 */
export const REQUEST_SLA_COPY = {
  urgency: {
    crumb: "Configuration > SLA Configurations > Urgency",
    title: "Urgency",
    subtitle: "Define how quickly a service request needs attention. Urgency and impact together set the priority.",
    link: "Open Priority Matrix",
    listTitle: (n: number) => `Urgency levels (${n})`,
    add: "Add urgency level",
    columns: ["Urgency level", "Colour", "Status"],
    searchPlaceholder: "Search urgency levels…",
    searchLabel: "Search urgency levels",
    empty: "No urgency levels match your search.",
    back: "Back to urgency levels",
    fields: { name: "Urgency name", description: "Description", order: "Display order", colour: "Colour", active: "Active" },
    descriptionPlaceholder: "When and how this should be used…",
  },
  priority: {
    crumb: "Configuration > SLA Configurations > Priority",
    title: "Priority",
    subtitle: "Define the priority levels a service request can carry, and the response and fulfilment SLA each one promises.",
    link: "Open Priority Matrix",
    listTitle: (n: number) => `Priority levels (${n})`,
    add: "Add priority level",
    columns: ["Priority level", "Response SLA", "Fulfilment SLA", "Colour", "Status"],
    searchPlaceholder: "Search priority levels…",
    searchLabel: "Search priority levels",
    empty: "No priority levels match your search.",
    back: "Back to priority levels",
    fields: { name: "Priority name", description: "Description", response: "Response SLA", fulfilment: "Fulfilment SLA", units: ["Minutes", "Hours", "Days"], order: "Display order", colour: "Colour", active: "Active" },
    descriptionPlaceholder: "When and how this should be used…",
  },
  serviceWindow: {
    crumb: "Configuration > SLA Configurations > Service Window",
    title: "SLA Service Window",
    subtitle: "Define named business-hour calendars and assign them to workgroups. The SLA clock on a service request runs only inside its workgroup's window.",
    listTitle: (n: number) => `Service windows (${n})`,
    add: "Add service window",
    columns: ["Service window", "Days", "Time", "Workgroups", "Status"],
    searchPlaceholder: "Search service windows…",
    searchLabel: "Search service windows",
    empty: "No service windows match your search.",
    back: "Back to service windows",
    fields: { name: "Service window name", description: "Description", days: "Days active", start: "Start time", end: "End time", timezone: "Timezone", workgroups: "Workgroups on this window", order: "Display order", active: "Active" },
    workgroupHint: "A workgroup uses one window at a time, so ticking it here moves it off its current window.",
    descriptionPlaceholder: "When and how this should be used…",
  },
} as const;
