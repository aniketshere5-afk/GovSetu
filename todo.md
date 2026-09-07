# Project TODO

- [x] Establish elegant, polished SetuGov visual system and responsive application shell
- [x] Implement role-based access for citizens, department officials, and platform administrators using the provided authentication system
- [x] Add canonical domain model for applications, businesses, departments, workflow steps, documents, consent, connectors, events, and immutable audit records
- [x] Implement guided business-registration application workflow with submission, document references, validation, routing, approval, and status updates
- [x] Implement unified application tracking timeline with department, milestone, timestamp, processing, remarks, and data-exchange context
- [x] Implement federated interoperability layer with normalized connector APIs for simulated independent department systems
- [x] Preserve department source-record independence and avoid centralizing departmental source records
- [x] Implement purpose-limited consent and citizen data-sharing controls
- [x] Implement official work queues for assigned cases, action requests, milestone updates, and decisions
- [x] Implement administrator tools for departments, connectors, integration health, failed events, and connector controls
- [x] Implement immutable audit-log inspection for administrators
- [x] Seed demo accounts and realistic sample cases for an end-to-end workflow demonstration
- [x] Add automated backend and domain tests and run the test suite
- [x] Write concise technical and user documentation for the MVP
- [x] Verify responsive UI, protected access, core workflow, interoperability simulation, and seeded demo experience in the browser

## Follow-up implementation gaps

- [x] Replace conditional placeholder panels with protected citizen, official, and administrator role experiences and seeded role accounts
- [x] Complete application submission persistence for document references, consent records, workflow steps, department routing, and lifecycle decisions
- [x] Replace the hardcoded tracking timeline with live backend application, workflow, and integration-event data
- [x] Implement simulated independent department connector endpoints and actual normalized exchanges without centralizing source records
- [x] Add citizen consent management and data-sharing history controls
- [x] Add working official queue review, action requests, milestone updates, approvals, and rejections
- [x] Add working administrator connector controls, failed-event handling, configuration, and audit-log inspection
- [x] Enforce audit immutability at the application/database contract level and document the constraint
- [x] Browser-verify authentication, role access, application submission, tracking, interoperability, and administration flows

## Final hardening gaps

- [x] Build real protected citizen, official, and administrator views/routes instead of toast-only panels
- [x] Extend workflow progression across departments with current-department updates and final approval/rejection transitions
- [x] Bind tracking UI to workflow steps and integration events with remarks, timestamps, exchanged data, and processing context
- [x] Implement separate simulated department connector API endpoints and invoke them from workflow exchange logic

## Verification and control-surface follow-ups

- [x] Expose citizen-visible data-sharing and integration-event history alongside consent records
- [x] Add an official request-action / send-back-for-correction UI path wired to action_required
- [x] Build administrator configuration screens for departments and connectors
- [x] Document the verified TiDB limitation for database triggers and keep audit protection insert-only at the application contract
- [x] Complete browser-based verification of signed-in citizen, official, and admin flows
- [x] Expand tracking detail UI with timestamps, payload context, and processing context

## Final evidence gaps

- [x] Browser-test authenticated citizen, official, and admin journeys end to end, including submission, review, request-action, approval/rejection, and admin configuration flows
- [x] Expand official/admin tracking event UI to display timestamps, payload summaries, exchange details, and processing context for each integration event
