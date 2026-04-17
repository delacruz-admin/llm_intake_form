variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "arb-intake"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "bedrock_model_id" {
  description = "Amazon Bedrock model ID"
  type        = string
  default     = "amazon.nova-lite-v1:0"
}

variable "cognito_domain_prefix" {
  description = "Cognito hosted UI domain prefix"
  type        = string
  default     = "arb-intake"
}

variable "frontend_local_url" {
  description = "Local dev frontend URL for Cognito callbacks"
  type        = string
  default     = "http://localhost:5173"
}

variable "owner" {
  description = "Team that owns this product"
  type        = string
  default     = "technology-infrastructure"
}

variable "cost_center" {
  description = "Cost center for billing allocation"
  type        = string
  default     = "1511"
}

variable "application_name" {
  description = "Human-readable application name"
  type        = string
  default     = "ARB Intake System"
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Owner       = var.owner
    CostCenter  = var.cost_center
    Application = var.application_name
  }
}
