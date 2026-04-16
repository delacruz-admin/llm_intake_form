# ── Cognito User Pool ──────────────────────────────────────

resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-users"

  auto_verified_attributes = ["email"]
  username_attributes       = ["email"]

  password_policy {
    minimum_length    = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  tags = local.common_tags
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${local.name_prefix}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["implicit"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]

  callback_urls = [
    "${var.frontend_local_url}/callback",
    "https://${aws_cloudfront_distribution.frontend.domain_name}/callback",
  ]

  logout_urls = [
    var.frontend_local_url,
    "https://${aws_cloudfront_distribution.frontend.domain_name}",
  ]

  supported_identity_providers = ["COGNITO"]
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.main.id
}


resource "aws_cognito_user_group" "reviewers" {
  name         = "arb-reviewers"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "ARB team members with review and admin privileges"
}
