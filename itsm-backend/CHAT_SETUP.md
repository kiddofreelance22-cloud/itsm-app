# AI Assistant

The chat assistant uses an OpenAI-compatible API. The supplied Docker Compose setup runs Ollama locally with the free `qwen2.5:3b` model; it does not require a paid model-provider API key. It can answer how-to questions, search the published service catalog, check a user's own ticket status, suggest real incident details, prepare incident/service-request/update drafts, summarize authorized incidents, and connect users to the Service Desk. Only an explicit Confirm button submits a draft. A typed "yes" never submits a draft.

## Free local setup

The root `docker-compose.yml` starts Ollama, downloads `qwen2.5:3b`, and points the backend at `http://ollama:11434/v1`. When running the backend directly on the host, it defaults to `http://127.0.0.1:11434/v1` and `qwen2.5:3b`. Local Ollama does not require an API key; `ollama` is sent as a placeholder. Remote OpenAI-compatible endpoints still require their own API key. The model is stored in the `ollama_data` Docker volume and runs on the host's available CPU/RAM. Common incident, summary, request, ticket-update, knowledge, and handover intents use the existing server-side tools directly; they do not depend on the model choosing a tool correctly.

## Configure

Set these variables in the backend environment:

| Variable | Required | Meaning |
|---|---|---|
| `OPENAI_API_KEY` | remote only | API key accepted by the configured OpenAI-compatible endpoint. For local Ollama this is optional. |
| `OPENAI_BASE_URL` | no | API base URL; defaults to `http://127.0.0.1:11434/v1` on the host. Docker Compose uses `http://ollama:11434/v1`. |
| `CHAT_MODEL` | no | Model name; defaults to `qwen2.5:3b`. |
| `CHAT_TIMEOUT_MS` | no | Model timeout in milliseconds; defaults to 90000 for the local model. |
| `CHAT_KNOWLEDGE_DIR` | no | Folder of `.md` / `.txt` policy and how-to files (default `./knowledge`). |

Restart the backend after changing its environment. Start Ollama before the backend when using a local model.

## Deploy

1. Apply the database migrations, including `1794700000002-CreateChatTables`, `1794800000000-CreateChatPendingActions`, and `1794900000000-IncidentTicketLinks`: `npm run migration:run`.
2. Put approved policy / SOP documents (as `.md` or `.txt`) in the knowledge folder and restart the backend.
3. Load the frontend; the chat widget is available across pages. Admins can view masked conversations and feedback at **Administration → Chatbot Feedback**.

## Ticket behavior

- Incident, service-request, and supported ticket-update actions are saved as pending drafts for 10 minutes. They are revalidated and applied through the existing incident/request services only after the user selects Confirm.
- Incident drafts use active categories, classifications, impact, and urgency values. Contact type defaults to the same Self-Service Portal option as the incident form, and priority is derived from the existing Impact × Urgency rule. The preview lets users choose a real classification and edit the suggested values.
- Drafts can be edited in the preview card. Confirming twice does not apply the change twice. Typing "yes" has no confirmation effect.
- Requests to speak with a person create a Service Desk handover incident from the masked recent conversation. The active assignment group must be named **Service Desk**.
- Only authorized Resolver/Analyst/Admin support roles can use ticket summaries and recorded-fix suggestions. End users never receive work notes.

## Safety and audit

- Tools run as the authenticated user and follow the existing ticket access, validation, priority, approval, status-transition, and SLA rules.
- Emails, phone numbers, PAN, Aadhaar-style IDs, and card numbers are masked before reaching the model and before being stored in chat history, tool audit data, and pending-action payloads. A contact number entered in the confirmation card is sent only to the ticket service and is not retained in the chat audit or pending-action payload.
- Message, tool, confirmation/cancellation, and feedback activity is stored in `chat_messages`. Rate limit: 20 user messages per minute.
- Confirm use of any external model with your organization; local Ollama requests stay on the configured machine/network.
