# ARB Intake System — Architecture Specification & Roadmap

Current state as of April 16, 2026. This document contains enough detail for a complete rebuild.

---

## 1. Product Overview

The ARB (Architecture Review Board) Intake System manages the lifecycle of technology infrastructure requests for an enterprise IT governance team. Requests cover new services, platform migrations, compliance initiatives, AI/ML pipelines, and vendor integrations.

The system provides:
- An AI-assisted conversational intake flow that guides requestors through submitting infrastructure requests
- A dashboard for tracking and managing all ARB requests with filtering, sorting, and detail views
- A triage/detail page for reviewers to manage request lifecycle
- Role-based access control separating submitters from reviewers
- AI-powered assistants for individual request review and portfolio-wide analysis

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python 3.12 Lambda functions |
| API | Amazon API Gateway (REST) with Cognito Authorizer |
| Database | Amazon DynamoDB (two tables, PAY_PER_REQUEST) |
| Storage | Amazon S3 (frontend hosting + file attachments) |
| CDN | Amazon CloudFront with OAC |
| Auth | Amazon Cognito (User Pools, Hosted UI, implicit OAuth) |
| AI | Amazon Bedrock (Converse API, model: amazon.nova-lite-v1:0) |
| IaC | Terraform >= 1.5 |
| Region | us-east-1 |

---

## 3. Project Structure

```
project-root/
├── .kiro/steering/              # AI steering rules (product.md, tech.md, structure.md, standards.md)
├── intake_demo/                 # Static HTML prototypes (design references only — never modify)
├── frontend/                    # React + Vite + Tailwind
│   ├── src/
│   │   ├── auth.js              # Cognito Hosted UI auth helper
│   │   ├── api/client.js        # API client with Authorization header
│   │   ├── components/
│   │   │   ├── Navbar.jsx       # Top nav bar
│   │   │   ├── Dashboard.jsx    # Initiatives register + Portfolio Assistant
│   │   │   ├── ChatPanel.jsx    # Intake chat (left column)
│   │   │   ├── PreviewPanel.jsx # Intake form preview (right column)
│   │   │   └── TriagePage.jsx   # Request detail/triage view
│   │   ├── App.jsx              # Root component, routing, auth gating
│   │   ├── main.jsx             # React entry point
│   │   └── index.css            # Tailwind directives + scrollbar styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js       # Custom Cooley theme (colors, fonts, border-radius)
│   ├── postcss.config.js
│   ├── package.json
│   └── .env.example             # Required env vars template
├── backend/functions/
│   ├── chat/app.py              # Intake chat Lambda
│   ├── requests/app.py          # Requests CRUD Lambda
│   ├── uploads/app.py           # File attachments Lambda
│   └── portfolio_chat/app.py    # Portfolio Assistant Lambda
├── infra/                       # Terraform
│   ├── main.tf                  # Provider config + default_tags
│   ├── variables.tf             # Input variables + locals
│   ├── dynamodb.tf              # DynamoDB tables + S3 attachments bucket
│   ├── cognito.tf               # User Pool, Client, Domain, Groups
│   ├── lambda.tf                # IAM roles, Lambda functions, packaging
│   ├── apigateway.tf            # REST API, authorizer, all routes, CORS, deployment
│   ├── cloudfront.tf            # S3 frontend bucket, OAC, CloudFront distribution
│   ├── ssm.tf                   # SSM parameter for Bedrock model ID
│   ├── backup.tf                # AWS Backup vault, plan, selection
│   └── outputs.tf               # Stack outputs
├── project-standards.md
├── ROADMAP.md
└── README.md
```

---

## 4. Design System (Tailwind Theme)

The UI follows a custom Cooley LLP design system defined in `tailwind.config.js`:

```
Colors:
  cooley-red: #C8102E (primary brand, buttons, active nav)
  cooley-red-hover: #A80D24
  cooley-red-light: #FEF2F4 (row hover, light backgrounds)
  cooley-red-mid: #F0C0C8 (borders)
  surface: #FFFFFF (default), #F6F6F6 (secondary), #EBEBEB (tertiary)
  border: #DCDCDC (default), #C4C4C4 (strong)
  text: #1C1C1C (default), #5A5A5A (dim), #9A9A9A (muted)
  semantic-green: #1A6E34, semantic-blue: #1E4D8C, etc.

Fonts:
  sans: Inter, system-ui
  serif: Georgia (headings)
  mono: Fira Code (IDs, badges, timestamps)

Border radius: cooley = 6px

Scrollbars: Custom thin scrollbars (6px) with #C4C4C4 thumb on #F6F6F6 track
```

---

## 5. Authentication

### Cognito Configuration
- User Pool with email-based sign-up, password policy (8+ chars, upper/lower/numbers)
- User Pool Client: implicit OAuth flow, no secret, scopes: openid, email, profile
- Hosted UI domain: `arb-intake.auth.us-east-1.amazoncognito.com`
- Callback URLs: `http://localhost:5173/callback` + `https://<cloudfront>/callback`
- Logout URLs: `http://localhost:5173` + `https://<cloudfront>`
- User group: `arb-reviewers` for reviewer/admin privileges

### Frontend Auth Flow (`auth.js`)
- On load: check for `id_token` in URL hash (OAuth callback), store in `sessionStorage` under key `arb_id_token`
- `getToken()`: returns token if present and not expired (checks JWT `exp` claim)
- `getUser()`: decodes JWT payload, extracts `email`, `name`, `sub`, `cognito:groups`, derives `isReviewer`
- `login()`: redirects to Cognito Hosted UI with `response_type=token`
- `logout()`: clears sessionStorage, redirects to Cognito logout endpoint
- `requireAuth()`: redirects to login if no valid token

### Environment Variables (frontend)
```
VITE_API_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com/prod
VITE_COGNITO_DOMAIN=https://arb-intake.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=<client-id>
VITE_REDIRECT_URI=http://localhost:5173/callback
VITE_LOGOUT_URI=http://localhost:5173
```

---

## 6. DynamoDB Data Model

### Sessions Table (`arb-intake-dev-sessions`)
| PK | SK | Content |
|---|---|---|
| `SESSION#<uuid>` | `MSG#<iso-timestamp>` | Chat message (role, content, timestamp) |
| `SESSION#<uuid>` | `FIELDS` | Extracted intake fields (updated incrementally) |

### Requests Table (`arb-intake-dev-requests`)
| PK | SK | Content |
|---|---|---|
| `REQUEST#<id>` | `META` | Request record (all fields, status, dates, submitter) |
| `REQUEST#<id>` | `NOTE#<ts>#<uuid>` | Triage note (text, author, timestamp) |
| `REQUEST#<id>` | `ANNOTATION#<ts>#<uuid>` | Field annotation (field_name, text, author) |
| `REQUEST#<id>` | `ACTIVITY#<ts>#<uuid>` | Activity log entry (text, author, hours, timestamp) |
| `REQUEST#<id>` | `ATTACHMENT#<uuid>` | File attachment metadata (filename, s3_key, category, content_type) |

**GSI1** (for listing/filtering):
| GSI1PK | GSI1SK | Purpose |
|---|---|---|
| `REQUESTS` | `STATUS#<status>#<created_at>` | List all requests, filter by status prefix |

### Request ID Format
`ARB-<year>-<6-char-hex>` (e.g., `ARB-2026-A1B2C3`)

### Request Fields
Submitter (auto-filled from login): `submitter`, `submitter_email`
Part A1 (Requestor): `team`, `poc_name`, `poc_email`, `exec_sponsor`
Part A2 (Details): `request_type`, `app_type`, `title`, `description`, `deliverables`
Part A3 (Impact): `business_outcomes`, `criticality`, `impact_if_not_done`, `impact_scale`, `need_date`
Part A4 (Dependencies): `vendor_involved`, `vendor_name`, `system_dependencies`, `discovery_stakeholders`
Part B: Attachments (stored as ATTACHMENT# items, categories: logical-diagram, vendor-doc, other)
Part C1-C6 (Discovery, optional): `environments_needed`, `hosting_preference`, `new_aws_account`, `aws_account_name`, `aws_region`, `sso_needed`, `access_patterns`, `deployment_model`, `compute_needed`, `database_needed`, `storage_needed`, `connectivity_type`, `vpc_requirements`, `compliance_frameworks`, `data_classification`, `encryption_requirements`, `additional_comments`
Triage fields: `status`, `assigned_to`, `criticality`, `promised_date`

### Statuses
`draft` → `received-pending` → `under-review` → `accepted-discovery` → `in-backlog` → `active` → `completed` | `deferred`

---

## 7. API Routes

All routes require Cognito Authorization except OPTIONS (CORS preflight).

| Method | Path | Lambda | Purpose |
|---|---|---|---|
| POST | /chat | chat | Send message, get AI response + extracted fields |
| POST | /requests | requests | Submit completed intake from session |
| GET | /requests | requests | List all requests (GSI1 query) |
| GET | /requests/{id} | requests | Get single request |
| PUT | /requests/{id} | requests | Update status, criticality, assigned_to, promised_date |
| DELETE | /requests/{id} | requests | Cascade delete (request + notes + annotations + activity) |
| POST | /requests/{id}/notes | requests | Add triage note |
| GET | /requests/{id}/notes | requests | List triage notes |
| PUT | /requests/{id}/notes | requests | Update note (body: {sk, text}) |
| DELETE | /requests/{id}/notes | requests | Delete note (body: {sk}) |
| POST | /requests/{id}/annotations | requests | Add field annotation |
| GET | /requests/{id}/annotations | requests | List annotations |
| PUT | /requests/{id}/annotations | requests | Update annotation (body: {sk, text}) |
| DELETE | /requests/{id}/annotations | requests | Delete annotation (body: {sk}) |
| POST | /requests/{id}/activity | requests | Add activity entry |
| GET | /requests/{id}/activity | requests | List activity entries |
| PUT | /requests/{id}/activity | requests | Update activity (body: {sk, text, hours}) |
| DELETE | /requests/{id}/activity | requests | Delete activity (body: {sk}) |
| GET | /requests/{id}/summary | requests | Generate AI summary via Bedrock |
| POST | /requests/{id}/review-chat | requests | Review Assistant chat (body: {message, history}) |
| POST | /requests/{id}/attachments | uploads | Get presigned PUT URL (body: {filename, content_type, category}) |
| GET | /requests/{id}/attachments | uploads | List attachments with presigned GET URLs |
| DELETE | /requests/{id}/attachments | uploads | Delete attachment (body: {file_id, s3_key}) |
| POST | /drafts | requests | Save new draft (body: {session_id, fields, submitter, submitter_email}) |
| PUT | /drafts | requests | Update existing draft (body: {request_id, fields}) |
| POST | /portfolio-chat | portfolio_chat | Portfolio-wide AI chat (body: {message, history}) |

**CRITICAL: Lambda route ordering** — In the requests Lambda handler, specific sub-resource routes (annotations PUT/DELETE, notes PUT/DELETE, activity PUT/DELETE) MUST be matched before generic request PUT/DELETE, otherwise the generic handler catches them first.

---

## 8. Backend Lambda Details

### Chat Lambda (`backend/functions/chat/app.py`)
- **Bedrock model**: Converse API with `amazon.nova-lite-v1:0` (configurable via env var)
- **System prompt**: ~3000 words defining dual-mode behavior (conversational or self-service), one-question-at-a-time flow, field extraction via `<extracted_fields>` JSON blocks, formatting rules, and completion flow
- **Session management**: Messages stored in DynamoDB sessions table, full history loaded for each call
- **Field extraction**: Regex parses `<extracted_fields>{...}</extracted_fields>` from model output, saves to FIELDS item
- **Response cleaning**: Strips `<extracted_fields>` blocks and `__INIT__` artifacts before returning to frontend
- **User context**: Logged-in user's name/email appended to system prompt; "myself"/"me" resolves to logged-in user
- **Draft awareness**: When resuming a draft, the greeting recognizes existing data
- **Inference config**: maxTokens=1000, temperature=0.7

### Requests Lambda (`backend/functions/requests/app.py`)
- **Submit**: Reads FIELDS from sessions table, generates request ID, creates META item with status `received-pending`
- **List**: GSI1 query on `GSI1PK=REQUESTS`, returns all non-draft requests
- **Update**: Supports `status`, `criticality`, `assigned_to`, `promised_date` — updates GSI1SK when status changes
- **Delete**: Cascade — queries all SK prefixes (META, NOTE#, ANNOTATION#, ACTIVITY#, ATTACHMENT#) and batch-deletes
- **AI Summary**: Loads request, sends to Bedrock with summary prompt, returns generated text
- **Review Chat**: Loads full request as context, sends to Bedrock Converse with reviewer-focused system prompt, supports conversation history
- **Draft save**: Creates request with status `draft`, stores all fields directly on META item
- **Draft update**: Updates existing draft's fields

### Uploads Lambda (`backend/functions/uploads/app.py`)
- **Upload**: Generates presigned PUT URL for S3, stores ATTACHMENT# item in DynamoDB with metadata
- **List**: Queries ATTACHMENT# items, generates presigned GET URLs for each
- **Delete**: Removes S3 object and DynamoDB ATTACHMENT# item
- **S3 bucket**: `arb-intake-dev-attachments-<account-id>` with versioning, CORS (PUT/GET from *), all public access blocked

### Portfolio Chat Lambda (`backend/functions/portfolio_chat/app.py`)
- **Data loading**: GSI1 query to load all non-draft requests
- **Context building**: Formats each request as structured text (ID, title, status, team, criticality, dates, description, etc.)
- **System prompt**: "ARB Portfolio Analyst" role, today's date injected, plain text responses
- **Inference config**: maxTokens=1024, temperature=0.3
- **History**: Keeps last 10 conversation turns

---

## 9. Frontend Components

### App.jsx (Root)
- Pages: `intake` (chat + preview), `dashboard`, `triage`
- Routing via `window.history.pushState` — paths: `/`, `/dashboard`, `/triage/<id>`
- Auth gating: redirects to Cognito if no valid token
- Auto-fills `submitter` and `submitter_email` from JWT on load
- `resumeDraft()`: loads draft fields from API, restores into intake form state

### Navbar.jsx
- Static top bar with "Architecture Review Board Intake Assistant" title
- Dashboard and New Request buttons; active page button shows in cooley-red
- User name display + Logout button on right

### Dashboard.jsx
- **Stat cards**: 6 cards (Total, Received, Under Review, Discovery, Backlog, Active) — clickable to filter
- **My Drafts**: Section visible when user has drafts, shows Continue and Delete (✕) buttons per draft
- **Initiatives Register**: Table with columns: ID, Submitted, Request (title + POC), Team, Type, Criticality, Status, SLA, Need Date, Promised Date
- **Sorting**: ID, Submitted, Team columns are clickable (toggle asc ▲ / desc ▼)
- **Search**: Text search across request_id, title, team, poc_name, description
- **Status filter**: Dropdown with all statuses
- **SLA countdown**: 5 business days from created_at. Shows time remaining for received-pending, "Reviewed" for reviewed statuses, "SLA Overdue" in red when past due. Color coding: green (>48h), amber (24-48h), red (<24h)
- **Promised Date**: Shows "TBD" when empty
- **Role filtering**: Submitters see only their own entries; reviewers see all
- **Portfolio Assistant**: Fixed-position chat drawer in bottom-right corner, toggles open/closed, sends to /portfolio-chat endpoint

### ChatPanel.jsx (Intake — Left Column)
- Chat interface with message bubbles (user = red, assistant = white)
- Paperclip icon for file upload with category picker (Logical Diagram, Vendor Document, Other Artifact)
- File upload flow: get presigned URL → upload to S3 → notify chat
- Session ID auto-generated on first message
- Draft-aware: when resuming, sends context to get appropriate greeting

### PreviewPanel.jsx (Intake — Right Column)
- All sections A1 through C6 with collapsible headers
- Auto-expand active section (being filled), collapse others
- Click-to-edit fields: clicking a field shows an input, blur saves
- Placeholder hints in light grey (from original form) that disappear on focus
- B-Attachments section: upload buttons per category (logical-diagram, vendor-doc, other), shows uploaded files with delete
- Progress bar: tracks ALL fields across all sections (not just Part A)
- Submit button: calls POST /requests, navigates to dashboard
- Save as Draft button: calls POST /drafts or PUT /drafts (if updating existing draft)

### TriagePage.jsx (Detail — Two Columns)
**Left column** (scrolls independently):
- Collapsible sections: Summary (expanded by default), all others collapsed
- Summary section: Status badge, Criticality badge, Assigned Technical Manager (or "Unassigned"), Submitted date, Need Date, AI-generated summary (loaded via GET /summary)
- All request fields displayed in their sections
- Field-level annotations: "ADD ANNOTATION" indicator on hover, click to add. Multiple annotations per field. Edit/delete (reviewer-only)

**Right column** (500px fixed width, scrolls independently):
- **Status buttons**: All statuses displayed as buttons, current status highlighted. Reviewer-only
- **Assigned Technical Manager**: Text input. Reviewer-only
- **Criticality buttons**: Low → Medium → High → Emergency (left to right). Color-matched: selected = bolder version of deselected color. Reviewer-only
- **Promised Date**: Date picker. Reviewer-only
- **Attachments**: List with download (presigned URL) and delete buttons
- **Review Assistant**: Chat interface for discussing the specific request with AI. Loads full request as context
- **Triage Notes**: Add/edit/delete notes with author and timestamp. Edit/delete on hover
- **Activity Log**: Engineering progress tracking. Add entries with optional hours field. Total hours rollup. Edit/delete on hover
- **Delete Request**: Red button at bottom. Reviewer-only. Confirms before cascade delete

---

## 10. Role-Based Access Control

| Capability | Submitter | Reviewer (`arb-reviewers` group) |
|---|---|---|
| See own entries | Yes | Yes (sees all entries) |
| Submit new request | Yes | Yes |
| Save/resume drafts | Yes (own only) | Yes (own only) |
| Add annotations | Yes | Yes |
| Edit/delete annotations | No | Yes |
| Change status | No | Yes |
| Assign technical manager | No | Yes |
| Set criticality | No | Yes |
| Set promised date | No | Yes |
| Delete request | No | Yes |
| Chat with Review Assistant | Yes | Yes |
| Use Portfolio Assistant | Yes | Yes |

Implementation: `user.isReviewer` derived from `cognito:groups` JWT claim containing `arb-reviewers`. Reviewer-only UI controls are conditionally rendered.

---

## 11. Infrastructure (Terraform)

### Provider Configuration (`main.tf`)
- AWS provider with `default_tags` block applying all 6 tags to every resource automatically
- Required providers: aws ~> 5.0, archive ~> 2.0

### Tagging Standard
All 20 taggable resources carry these tags:

| Tag | Value |
|---|---|
| Project | arb-intake |
| Environment | dev |
| ManagedBy | terraform |
| Owner | technology-infrastructure |
| CostCenter | 1511 |
| Application | ARB Intake System |

### Variables (`variables.tf`)
- `aws_region` (default: us-east-1)
- `project_name` (default: arb-intake)
- `environment` (default: dev)
- `bedrock_model_id` (default: amazon.nova-lite-v1:0)
- `cognito_domain_prefix` (default: arb-intake)
- `frontend_local_url` (default: http://localhost:5173)
- `owner` (default: technology-infrastructure)
- `cost_center` (default: 1511)
- `application_name` (default: ARB Intake System)
- `locals.name_prefix` = `${project_name}-${environment}`

### Lambda Packaging
Each Lambda is zipped via Terraform `archive_file` data source from `backend/functions/<name>/` to `infra/.build/<name>.zip`. Source code hash triggers redeployment on code changes.

### API Gateway Deployment
Single deployment resource with `triggers.redeployment` = sha1 of all method and integration resource IDs. `create_before_destroy` lifecycle. Single stage: `prod`.

### Backups (`backup.tf`)
- AWS Backup vault + daily plan (cron: `0 5 * * ? *` UTC)
- 7-day retention
- Both DynamoDB tables selected via ARN list

### Outputs
- `api_url`, `cloudfront_url`, `cloudfront_distribution_id`, `frontend_bucket_name`
- `user_pool_id`, `user_pool_client_id`, `cognito_domain_url`

---

## 12. Deployment Flow

```bash
# 1. Infrastructure
cd infra
terraform init
terraform apply

# 2. Frontend build
cd frontend
npm install
npm run build

# 3. Deploy frontend to S3 + invalidate CloudFront
aws s3 sync dist/ s3://$(cd ../infra && terraform output -raw frontend_bucket_name) --delete
aws cloudfront create-invalidation \
  --distribution-id $(cd ../infra && terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```

Lambda code deploys automatically via `terraform apply` (archive_file detects source changes).

---

## 13. Chat System Prompt Summary

The intake chat system prompt (~3000 words) defines:
- **Dual mode**: User can fill form directly or be guided conversationally
- **One question at a time**: Never ask multiple fields in one message
- **Acknowledge and move on**: Brief acknowledgment, no commentary on answers
- **No markdown**: Plain text only, no bold, no headers
- **No section references**: Never mention "Part A", "A1", etc. — the preview panel handles structure
- **Field extraction**: Every response must include `<extracted_fields>{"field": "value"}</extracted_fields>`
- **Formatting rules**: Fix spelling, title case names, YYYY-MM-DD dates, normalize enums
- **Self-reference resolution**: "myself"/"me" → logged-in user's name/email
- **Submitter auto-fill**: Submitter captured from login, but POC must still be asked (may differ)
- **Parts A (required) → B (attachments) → C (optional discovery)**: Clear progression with opt-out for Part C
- **Completion**: Brief summary, confirm before submission, mention 3-day triage SLA

---

## 14. Remaining Phases

### Phase 2: Semantic Search (Bedrock Knowledge Base)

**Status:** Designed, not started

The Portfolio Assistant currently loads all requests into the Bedrock prompt via context stuffing. This works at current scale but won't scale past a few hundred requests.

**Architecture:**
- Enable DynamoDB Streams on the requests table
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
- Multi-step form wizard in React (new component, new nav button)
- Dedicated Lambda + DynamoDB storage (or extend existing requests table with a different GSI1PK)
- Approval workflow tied to ARB review process
- Integration with AWS Control Tower / Service Catalog (future)
