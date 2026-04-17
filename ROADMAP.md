# ARB Intake System — Architecture & Roadmap

Current state as of April 16, 2026.

---

## Current Architecture

### Overview

The ARB Intake System is a serverless web application for managing technology infrastructure requests through the Architecture Review Board. It runs entirely on AWS with no always-on compute.

### Infrastructure (Terraform, us-east-1)

All resources are defined in `infra/` and managed via Terraform >= 1.5. Every resource carries 6 standard tags (Project, Environment, ManagedBy, Owner, CostCenter, Application) applied automatically via the AWS provider `default_tags` block.

| Service | Resource | Purpose |
|---|---|---|
| CloudFront | Distribution `E10Z7822CAZJYK` | HTTPS frontend delivery, SPA routing, gzip, CachingOptimized |
| S3 | `arb-intake-dev-frontend-*` | Static frontend assets (React build output), no public access, OAC only |
| S3 | `arb-intake-dev-attachments-*` | File attachments with versioning enabled |
| API Gateway | REST API `arb-intake-dev-api` | All backend routes, Cognito authorizer on every endpoint (except OPTIONS) |
| Lambda | `arb-intake-dev-chat` | Intake chat — Bedrock Converse API, one-question-at-a-time field extraction |
| Lambda | `arb-intake-dev-requests` | CRUD for requests, notes, annotations, activity log, AI summary, review chat |
| Lambda | `arb-intake-dev-uploads` | Presigned URL generation for S3 attachments (upload, download, delete) |
| Lambda | `arb-intake-dev-portfolio-chat` | Portfolio Assistant — loads all requests, answers questions via Bedrock |
| DynamoDB | `arb-intake-dev-sessions` | Chat sessions + messages (PK: SESSION#id, SK: MSG#ts or FIELDS) |
| DynamoDB | `arb-intake-dev-requests` | ARB requests + notes + annotations + activity (GSI1 for list/filter by status) |
| Cognito | User Pool `us-east-1_M5GFnGgeG` | Auth with Hosted UI, implicit OAuth flow, `arb-reviewers` group for RBAC |
| SSM | `/arb-intake/bedrock-model-id` | Configurable Bedrock model ID (currently `amazon.nova-lite-v1:0`) |
| Backup | Daily vault + plan | Both DynamoDB tables backed up daily at 05:00 UTC, 7-day retention via AWS Backup |

### Frontend (React + Vite + Tailwind)

| Component | File | Purpose |
|---|---|---|
| App shell | `App.jsx` | Page routing (dashboard, new-request, triage, resume-draft), auth gating |
| Navbar | `Navbar.jsx` | Static top nav with Dashboard and New Request buttons, active state in red |
| Dashboard | `Dashboard.jsx` | Stat cards, search, status filter, sortable columns (ID/Submitted/Team), My Drafts section, Portfolio Assistant chat drawer |
| ChatPanel | `ChatPanel.jsx` | Intake chat with Bedrock, one question at a time, file upload via paperclip |
| PreviewPanel | `PreviewPanel.jsx` | Intake form preview (A1–C6), collapsible sections, click-to-edit fields, progress bar, upload buttons, Submit/Save as Draft |
| TriagePage | `TriagePage.jsx` | Two-column detail view: left (collapsible request sections, field annotations), right (status buttons, assigned TM, criticality, promised date, attachments, Review Assistant chat, triage notes, activity log, delete) |
| Auth | `auth.js` | Cognito Hosted UI redirect, JWT from sessionStorage, `user.isReviewer` from `cognito:groups` |
| API client | `api/client.js` | All API calls with Authorization header, auto-redirect on 401 |

### Backend (Python 3.12 Lambdas)

**Chat Lambda** (`backend/functions/chat/app.py`):
- Bedrock Converse API with system prompt guiding one-question-at-a-time intake
- Extracts fields via `<extracted_fields>` JSON blocks in model output
- Auto-fills submitter from Cognito login, resolves "myself"/"me" to logged-in user
- Draft-aware greeting on resume, dual mode (conversational or direct entry)

**Requests Lambda** (`backend/functions/requests/app.py`):
- POST /requests — submit completed intake from session
- POST /drafts, PUT /drafts — save/update drafts
- GET /requests — list all (GSI1 query), GET /requests/{id} — single request
- PUT /requests/{id} — update status, criticality, assigned_to, promised_date
- DELETE /requests/{id} — cascade delete (request + notes + annotations + activity)
- CRUD for /notes, /annotations, /activity (all under /requests/{id}/)
- GET /requests/{id}/summary — Bedrock-generated AI summary
- POST /requests/{id}/review-chat — Review Assistant conversation with full request context

**Uploads Lambda** (`backend/functions/uploads/app.py`):
- POST — generate presigned PUT URL for S3 upload with category
- GET — list attachments + generate presigned GET URLs for download
- DELETE — remove from both S3 and DynamoDB

**Portfolio Chat Lambda** (`backend/functions/portfolio_chat/app.py`):
- Loads all non-draft requests from DynamoDB via GSI1 query
- Formats as text context document, sends to Bedrock Converse
- Answers portfolio-wide questions (trends, risks, comparisons, statistics)

### API Routes

| Method | Path | Lambda | Auth |
|---|---|---|---|
| POST | /chat | chat | Cognito |
| POST | /requests | requests | Cognito |
| GET | /requests | requests | Cognito |
| GET | /requests/{id} | requests | Cognito |
| PUT | /requests/{id} | requests | Cognito |
| DELETE | /requests/{id} | requests | Cognito |
| POST/GET/PUT/DELETE | /requests/{id}/notes | requests | Cognito |
| POST/GET/PUT/DELETE | /requests/{id}/annotations | requests | Cognito |
| POST/GET/PUT/DELETE | /requests/{id}/activity | requests | Cognito |
| GET | /requests/{id}/summary | requests | Cognito |
| POST | /requests/{id}/review-chat | requests | Cognito |
| POST/GET/DELETE | /requests/{id}/attachments | uploads | Cognito |
| POST/PUT | /drafts | requests | Cognito |
| POST | /portfolio-chat | portfolio_chat | Cognito |

### Role-Based Access

| Capability | Submitter | Reviewer (arb-reviewers group) |
|---|---|---|
| See own entries | Yes | Yes (all entries) |
| Submit new request | Yes | Yes |
| Add annotations | Yes | Yes |
| Edit/delete annotations | No | Yes |
| Change status | No | Yes |
| Assign technical manager | No | Yes |
| Set criticality | No | Yes |
| Set promised date | No | Yes |
| Delete request | No | Yes |
| Chat with Review Assistant | Yes | Yes |

### Tagging Standard

All 20 taggable AWS resources carry these tags via provider `default_tags`:

| Tag | Value |
|---|---|
| Project | arb-intake |
| Environment | dev |
| ManagedBy | terraform |
| Owner | technology-infrastructure |
| CostCenter | 1511 |
| Application | ARB Intake System |

### Statuses

Draft → Received, Pending Review → Under Review → Accepted - In Discovery → In Backlog → Active → Completed / Deferred


---

## Remaining Phases

### Phase 2: Semantic Search (Bedrock Knowledge Base)

**Status:** Designed, not started

The Portfolio Assistant currently loads all requests into the Bedrock prompt via context stuffing. This works at current scale but won't scale past a few hundred requests.

**Architecture:**
- Enable DynamoDB Streams on the `arb-intake-dev-requests` table
- Sync Lambda triggered by stream events writes request documents as JSON files to a dedicated S3 bucket
- Bedrock Knowledge Base backed by OpenSearch Serverless (vector search collection)
- Knowledge Base auto-generates embeddings via Titan Embeddings and indexes into OpenSearch
- Portfolio Assistant Lambda switches from Converse (context stuffing) to `RetrieveAndGenerate` API
- Enables true semantic search: "find requests similar to our Snowflake migration"

**New AWS resources:**
- OpenSearch Serverless collection (vector search)
- Bedrock Knowledge Base + data source (S3)
- S3 bucket for knowledge base documents
- DynamoDB Streams event source mapping
- Sync Lambda (Python 3.12)
- IAM roles for Knowledge Base, OpenSearch, sync Lambda

**Terraform files:** `infra/knowledge_base.tf`, `infra/opensearch.tf`
**Backend:** `backend/functions/kb_sync/app.py`

---

### SSO Integration

**Status:** Discussed, not started

Replace Cognito Hosted UI username/password auth with enterprise SSO via the cooley.com domain. The `arb-reviewers` Cognito group would map to an Active Directory group.

**Approach:**
- Configure Cognito User Pool with SAML or OIDC identity provider (Azure AD / Entra ID)
- Map AD group membership to Cognito groups for role-based access
- Remove manual user creation — users auto-provision on first SSO login
- Callback/logout URLs already support both localhost and CloudFront

---

### AWS Environment Provisioning Request Form

**Status:** Prototype exists (`intake_demo/arb-env-request.html`), not built in React

A multi-step wizard for requesting new AWS environments (accounts, networking, IAM). Separate from the general ARB intake flow.

**Scope:**
- Multi-step form wizard in React
- Dedicated Lambda + DynamoDB storage
- Approval workflow tied to ARB review process
- Integration with AWS Control Tower / Service Catalog (future)
