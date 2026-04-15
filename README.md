# ARB Intake System

AI-assisted Architecture Review Board intake system for Cooley Technology Infrastructure.

## Architecture

- **Frontend:** React + Vite + Tailwind CSS → S3 + CloudFront
- **Backend:** API Gateway (REST) + Lambda (Python 3.12)
- **AI:** Amazon Bedrock (`amazon.nova-lite-v1:0`)
- **Database:** DynamoDB (single-table design)
- **Auth:** Cognito User Pool + Hosted UI
- **IaC:** Terraform

## Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform >= 1.5
- Node.js 18+ and npm
- Python 3.12

## Deploy Infrastructure

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform plan
terraform apply
```

Note the outputs (API URL, Cognito domain, client ID, CloudFront URL).

## Setup Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with values from terraform output
npm install
npm run dev
```

## Deploy Frontend

```bash
cd frontend
npm run build

# Use values from terraform output
aws s3 sync dist/ s3://$(cd ../infra && terraform output -raw frontend_bucket_name) --delete
aws cloudfront create-invalidation \
  --distribution-id $(cd ../infra && terraform output -raw cloudfront_distribution_id) \
  --paths "/*"
```

## Local Development

```bash
# Terminal 1 — frontend
cd frontend
npm run dev
```

Update `VITE_API_URL` in `.env.local` to point to your deployed API Gateway URL (local Lambda testing requires SAM CLI separately if needed).

## Terraform Outputs

After `terraform apply`, these values are available:

| Output | Description |
|---|---|
| `api_url` | API Gateway endpoint |
| `cloudfront_url` | CloudFront distribution URL |
| `cloudfront_distribution_id` | For cache invalidation |
| `frontend_bucket_name` | S3 bucket for `aws s3 sync` |
| `user_pool_id` | Cognito User Pool ID |
| `user_pool_client_id` | For `VITE_COGNITO_CLIENT_ID` |
| `cognito_domain_url` | For `VITE_COGNITO_DOMAIN` |
