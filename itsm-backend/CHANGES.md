# Chatbot changes

## Confirmation-based ticket assistant

- Added migration `1794800000000-CreateChatPendingActions` for expiring incident, service-request, ticket-update, and handover actions.
- Added editable incident/service-request preview cards and explicit confirmation/cancellation. Updates are limited to public comments/information, staff work notes, contact-number changes, and requests to reopen Resolved incidents.
- Completed required incident draft fields using real classifications, the incident form's default contact type, and the existing Impact × Urgency priority rule.
- Added real-data incident suggestions, similar-ticket results, expanded own-ticket status, authorized staff ticket summaries and recorded-fix suggestions, and Service Desk handover.
- Added simple server-side greeting/status/problem/how-to/catalog routing, tool-round limits, malformed-response fallback, and guards against unsupported creation claims.
- Persisted chat sessions across page changes, added optional thumbs-down reasons, and added the Admin-only Chatbot Feedback report.
- Updated `CHAT_SETUP.md` with configuration, migration, behavior, and safety details.
