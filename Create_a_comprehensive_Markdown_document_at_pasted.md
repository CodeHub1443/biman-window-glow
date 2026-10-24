Create a comprehensive Markdown document at `docs/BACKEND_INTEGRATION_HANDOFF.md` for my backend coding agent.

Analyze the completed frontend, including its pages, Settings sections, mock services, data models, configuration, and `docs/backend-integration-readiness.md`.

Document everything the backend agent needs to implement the backend and integrate it with this frontend, including:

1. System architecture and frontend behavior.
2. All required API endpoints, HTTP methods, request/response examples, and data schemas.
3. Camera configuration, RTSP management, ROI settings, and detection parameters.
4. Visitor entry/exit events, face snapshots, duplicate suppression, greeting/audio control, and dwell-time tracking.
5. Dashboard statistics, event filtering, analytics, CSV export requirements, and system health.
6. Station/device management and station-specific Visitor Display settings.
7. Real-time updates, event delivery, and configuration synchronization.
8. Authentication, authorization, validation, error handling, and secure credential management.
9. Database entities, relationships, persistence requirements, and migrations.
10. Mapping between existing frontend mock services/models and the proposed backend APIs.
11. Implementation phases, dependencies, acceptance criteria, and tests.
12. Missing information, unresolved decisions, and assumptions requiring confirmation.

Important:
- Inspect the actual frontend code and existing documentation. Do not rely only on page descriptions.
- Clearly distinguish verified existing behavior from proposed backend requirements.
- Do not invent existing endpoints, credentials, infrastructure, or implemented capabilities.
- Where an API contract is not yet defined, propose a concrete contract and label it as a proposal.
- Preserve the approved Visitor Display and kiosk behavior.
- Keep the document self-contained so a coding agent working in a separate IDE can read it and understand what to implement without access to the Lovable project.
- Include example JSON payloads, schemas, endpoint tables, and a practical implementation checklist where useful.
- Do not implement the backend or change the frontend in this task.

After creating the file, report its exact path and summarize its contents.