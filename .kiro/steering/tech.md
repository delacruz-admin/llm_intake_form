# Tech Stack & Build

## Current State (Prototypes)

The `intake_demo/` folder contains static HTML prototypes — single-file HTML pages with inline CSS and vanilla JavaScript. These are design references, not production code.

## Production Stack

### Frontend
- React with Vite as the build tool
- Tailwind CSS (no other CSS frameworks)
- Functional components with hooks only
- State: React Context (simple) or Zustand (complex)

### Backend
- Lambda functions in Python 3.12 (source in `backend/functions/`)
- API Gateway (REST) with Cognito Authorizer
- Each Lambda does one thing — keep handlers small

### Infrastructure
- Terraform (>= 1.5) in the `infra/` directory
- Split into logical files: dynamodb.tf, cognito.tf, lambda.tf, apigateway.tf, cloudfront.tf, ssm.tf
- Lambda code is zipped by Terraform's `archive_file` data source from `backend/functions/`

### AI / GenAI
- Amazon Bedrock only — no direct third-party LLM API calls from app code
- Default model: `amazon.nova-lite-v1:0` (configurable via Terraform variable + SSM)
- Agentic workflows: Amazon Bedrock AgentCore

### Database & Storage
- DynamoDB (single-table design, PAY_PER_REQUEST)
- S3 for frontend hosting (CloudFront OAC, no public access)

### Auth
- Amazon Cognito (User Pools + Hosted UI, implicit OAuth flow)
- Cognito Authorizer on API Gateway — always, from day one
- JWT in sessionStorage, attached as Authorization header

## Common Commands

```bash
# Infrastructure
cd infra
terraform init           # first time setup
terraform plan           # preview changes
terraform apply          # deploy
terraform output         # view outputs (API URL, Cognito, CloudFront, etc.)

# Frontend
cd frontend
npm install              # install dependencies
npm run dev              # local dev server (Vite)
npm run build            # production build

# Deploy frontend to S3/CloudFront
aws s3 sync dist/ s3://$(cd ../infra && terraform output -raw frontend_bucket_name) --delete
aws cloudfront create-invalidation \
  --distribution-id $(cd ../infra && terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```
