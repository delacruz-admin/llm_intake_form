# ARB Intake System — Architecture Roadmap

Current state as of April 16, 2026. Items below have been discussed but not yet built.

---

## Phase 2: Semantic Search (Bedrock Knowledge Base)

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

## SSO Integration

**Status:** Discussed, not started

Replace Cognito Hosted UI username/password auth with enterprise SSO via the cooley.com domain. The `arb-reviewers` Cognito group would map to an Active Directory group.

**Approach:**
- Configure Cognito User Pool with SAML or OIDC identity provider (Azure AD / Entra ID)
- Map AD group membership to Cognito groups for role-based access
- Remove manual user creation — users auto-provision on first SSO login
- Callback/logout URLs already support both localhost and CloudFront

---

## AWS Environment Provisioning Request Form

**Status:** Prototype exists (`intake_demo/arb-env-request.html`), not built in React

A multi-step wizard for requesting new AWS environments (accounts, networking, IAM). Separate from the general ARB intake flow.

**Scope:**
- Multi-step form wizard in React
- Dedicated Lambda + DynamoDB storage
- Approval workflow tied to ARB review process
- Integration with AWS Control Tower / Service Catalog (future)

---

## Completed Items (for reference)

- Intake chat with Bedrock (one-question-at-a-time, field extraction)
- Dashboard with stat cards, search, status filter, sortable columns
- Triage/detail page (two-column, collapsible sections, annotations, notes, activity log)
- Preview panel with direct edit, collapsible sections, progress bar
- File attachments (S3 presigned URLs, upload/download/delete, category picker)
- Role-based access (Cognito groups, reviewer-only controls)
- Save as Draft / Resume
- DynamoDB split (sessions + requests tables) with PITR + daily backups
- Review Assistant AI chat (per-request)
- Portfolio Assistant AI chat (register-wide, context stuffing)
- SLA countdown (5 business days)
- Completed status
- AWS resource tagging (6-tag standard via provider default_tags)
