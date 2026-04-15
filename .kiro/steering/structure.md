# Project Structure

```
project-root/
├── .kiro/steering/              # AI steering rules
├── intake_demo/                 # Static HTML prototypes (design references only — do not modify)
│   ├── arb-dashboard.html
│   ├── arb-intake-chat.html
│   ├── arb-env-request.html
│   ├── cooley-style-guide_v1.html
│   ├── arb-aws-architecture.docx
│   └── ARB_Intake Request Questions_v1_01.09.2026.docx
├── frontend/                    # React + Vite + Tailwind
│   ├── src/
│   │   ├── auth.js                  # Cognito hosted UI auth helper
│   │   ├── api/client.js            # API client with Authorization header
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── ChatPanel.jsx
│   │   │   └── PreviewPanel.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── .env.example
├── backend/                     # Lambda function source code
│   └── functions/
│       ├── chat/app.py              # Chat Lambda — Bedrock conversation + field extraction
│       └── requests/app.py          # Requests Lambda — CRUD for intake requests
├── infra/                       # Terraform infrastructure
│   ├── main.tf                      # Provider config
│   ├── variables.tf                 # Input variables + locals
│   ├── dynamodb.tf                  # DynamoDB single-table
│   ├── cognito.tf                   # User Pool, Client, Domain
│   ├── lambda.tf                    # IAM roles, Lambda functions, packaging
│   ├── apigateway.tf                # REST API, Cognito authorizer, routes, CORS
│   ├── cloudfront.tf                # S3 bucket, OAC, CloudFront distribution
│   ├── ssm.tf                       # SSM parameter for Bedrock model ID
│   ├── outputs.tf                   # Stack outputs
│   └── terraform.tfvars.example
├── project-standards.md         # Canonical tech standards
├── README.md
└── .gitignore
```

## Key Conventions

- `intake_demo/` files are reference prototypes — do not modify them for production use
- `project-standards.md` is the source of truth for all architectural decisions
- Infrastructure is managed with Terraform in the `infra/` directory
- Lambda source code lives in `backend/functions/` — Terraform zips and deploys it
- All config (API URLs, model IDs, table names) comes from environment variables
- Frontend auth uses Cognito Hosted UI with implicit flow — no Amplify SDK
