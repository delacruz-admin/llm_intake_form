# Project Standards & Architecture Guidelines

These rules apply to every new project. Follow them by default unless the user explicitly overrides a specific choice.

---

## Frontend

- Framework: React (Vite as the build tool)
- Styling: Tailwind CSS — no other CSS frameworks
- Component pattern: Functional components with hooks only, no class components
- State management: React Context for simple state, Zustand for anything more complex
- No static HTML prototypes — always scaffold a proper React app

---

## Backend

- IaC: Terraform (>= 1.5) — all infrastructure defined in `infra/` directory
- API layer: Amazon API Gateway (REST API) backed by AWS Lambda functions
- Language: Python 3.12 for Lambda handlers unless the user specifies otherwise
- Each Lambda should do one thing — keep handlers small and focused
- Lambda source in `backend/functions/` — Terraform zips and deploys via `archive_file`
- API authentication: Always add a Cognito Authorizer to the API Gateway from the start — never deploy unauthenticated endpoints
  - OPTIONS (CORS preflight) methods use `authorization = "NONE"` so they are not blocked

---

## Generative AI

- Platform: Amazon Bedrock — never call third-party LLM APIs (OpenAI, Anthropic direct, etc.) from application code
- Default model: `amazon.nova-lite-v1:0` as the starting point for all GenAI features
- Model IDs are config, not hardcode — store the model ID in an environment variable or SSM Parameter Store so it can be swapped without a code change
- Agents: Use Amazon Bedrock AgentCore for anything requiring agentic behavior (multi-step reasoning, tool use, memory, orchestration)
- Embeddings / RAG: Use Bedrock Knowledge Bases when retrieval-augmented generation is needed

---

## Database

- Default (NoSQL): Amazon DynamoDB — prefer this for most use cases; serverless, no cluster to manage
  - Use single-table design where practical
  - Define GSIs in the SAM template
- Relational (when truly needed): Amazon RDS Aurora Serverless v2 with PostgreSQL
  - Only reach for this when the data model genuinely requires relational integrity or complex joins
  - Use Aurora Serverless v2 so it scales to zero

---

## Storage

- Object/file storage: Amazon S3
  - Separate buckets per concern (uploads, processed output, static assets, etc.)
  - Enable versioning on buckets that hold user data
  - Never store secrets or credentials in S3

---

## Authentication

- Auth platform: Amazon Cognito
  - User Pools for authentication (sign-up, sign-in, MFA)
  - Identity Pools if AWS resource access from the client is needed
  - Protect API Gateway endpoints with a Cognito Authorizer — not API keys
  - JWT tokens only; never roll custom auth
- Always include in Terraform from day one:
  - `AWS::Cognito::UserPool` with email-based sign-up and password policy
  - `AWS::Cognito::UserPoolClient` with implicit OAuth flow (no secret), scopes: openid, email, profile
  - `AWS::Cognito::UserPoolDomain` for the hosted sign-in UI
  - Callback/logout URLs for both `http://localhost:*` (dev) and the CloudFront distribution URL (prod)
- Frontend auth pattern: Use Cognito Hosted UI with implicit flow — no Amplify SDK needed
  - Store the ID token in `sessionStorage` (not `localStorage`)
  - Attach the token as the `Authorization` header on every API request
  - Redirect to Cognito sign-in if the token is missing or expired

---

## General Principles

- Serverless first — avoid EC2, ECS, or any always-on compute unless there is a clear reason
- Infrastructure as code always — every AWS resource must be defined in Terraform, never click-ops
- Environment variables for config — no hardcoded ARNs, URLs, table names, or model IDs in code
- Least privilege IAM — Lambda execution roles get only the permissions they need, nothing more
- Secrets: Use AWS Secrets Manager or SSM Parameter Store — never `.env` files committed to source control

---

## Frontend Hosting

- Always include S3 + CloudFront in Terraform — never rely solely on `localhost` or manual S3 static hosting
  - S3 bucket with all public access blocked (no static website hosting mode)
  - CloudFront Origin Access Control (OAC) — only CloudFront can read from the bucket
  - CloudFront distribution with HTTPS redirect, gzip compression, and `CachingOptimized` cache policy
  - SPA routing: add custom error responses for 403 and 404 → `/index.html` with 200 status
- Deploy flow: `npm run build` → `aws s3 sync dist/ s3://BUCKET --delete` → `aws cloudfront create-invalidation`
- Output the CloudFront URL, bucket name, and distribution ID from Terraform outputs for easy scripting