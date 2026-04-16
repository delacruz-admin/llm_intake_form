# ── SSM Parameter Store ────────────────────────────────────

resource "aws_ssm_parameter" "bedrock_model_id" {
  name  = "/${var.project_name}/bedrock-model-id"
  type  = "String"
  value = var.bedrock_model_id
}
