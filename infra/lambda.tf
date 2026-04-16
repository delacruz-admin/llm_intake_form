# ── Lambda IAM ─────────────────────────────────────────────

resource "aws_iam_role" "chat_lambda" {
  name = "${local.name_prefix}-chat-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "chat_lambda" {
  name = "${local.name_prefix}-chat-lambda-policy"
  role = aws_iam_role.chat_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
        ]
        Resource = [
          aws_dynamodb_table.sessions.arn,
          "${aws_dynamodb_table.sessions.arn}/index/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
    ]
  })
}

resource "aws_iam_role" "requests_lambda" {
  name = "${local.name_prefix}-requests-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "requests_lambda" {
  name = "${local.name_prefix}-requests-lambda-policy"
  role = aws_iam_role.requests_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ]
        Resource = [
          aws_dynamodb_table.requests.arn,
          "${aws_dynamodb_table.requests.arn}/index/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
        ]
        Resource = [
          aws_dynamodb_table.sessions.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
    ]
  })
}

# ── Lambda Packages ────────────────────────────────────────

data "archive_file" "chat_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/chat"
  output_path = "${path.module}/.build/chat.zip"
}

data "archive_file" "requests_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/requests"
  output_path = "${path.module}/.build/requests.zip"
}

# ── Lambda Functions ───────────────────────────────────────

resource "aws_lambda_function" "chat" {
  function_name    = "${local.name_prefix}-chat"
  role             = aws_iam_role.chat_lambda.arn
  handler          = "app.handler"
  runtime          = "python3.12"
  timeout          = 60
  memory_size      = 256
  filename         = data.archive_file.chat_lambda.output_path
  source_code_hash = data.archive_file.chat_lambda.output_base64sha256

  environment {
    variables = {
      SESSIONS_TABLE   = aws_dynamodb_table.sessions.name
      BEDROCK_MODEL_ID = var.bedrock_model_id
    }
  }
}

resource "aws_lambda_function" "requests" {
  function_name    = "${local.name_prefix}-requests"
  role             = aws_iam_role.requests_lambda.arn
  handler          = "app.handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.requests_lambda.output_path
  source_code_hash = data.archive_file.requests_lambda.output_base64sha256

  environment {
    variables = {
      REQUESTS_TABLE   = aws_dynamodb_table.requests.name
      SESSIONS_TABLE   = aws_dynamodb_table.sessions.name
      BEDROCK_MODEL_ID = var.bedrock_model_id
    }
  }
}


# ── Uploads Lambda ─────────────────────────────────────────

resource "aws_iam_role" "uploads_lambda" {
  name = "${local.name_prefix}-uploads-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "uploads_lambda" {
  name = "${local.name_prefix}-uploads-lambda-policy"
  role = aws_iam_role.uploads_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
        ]
        Resource = "${aws_s3_bucket.attachments.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
        ]
        Resource = aws_s3_bucket.attachments.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:DeleteItem",
        ]
        Resource = [
          aws_dynamodb_table.requests.arn,
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
    ]
  })
}

data "archive_file" "uploads_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/uploads"
  output_path = "${path.module}/.build/uploads.zip"
}

resource "aws_lambda_function" "uploads" {
  function_name    = "${local.name_prefix}-uploads"
  role             = aws_iam_role.uploads_lambda.arn
  handler          = "app.handler"
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.uploads_lambda.output_path
  source_code_hash = data.archive_file.uploads_lambda.output_base64sha256

  environment {
    variables = {
      ATTACHMENTS_BUCKET = aws_s3_bucket.attachments.id
      REQUESTS_TABLE     = aws_dynamodb_table.requests.name
    }
  }
}

resource "aws_lambda_permission" "uploads_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.uploads.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}


# ── Portfolio Chat Lambda ──────────────────────────────────

resource "aws_iam_role" "portfolio_chat_lambda" {
  name = "${local.name_prefix}-portfolio-chat-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "portfolio_chat_lambda" {
  name = "${local.name_prefix}-portfolio-chat-lambda-policy"
  role = aws_iam_role.portfolio_chat_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:Scan",
        ]
        Resource = [
          aws_dynamodb_table.requests.arn,
          "${aws_dynamodb_table.requests.arn}/index/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
    ]
  })
}

data "archive_file" "portfolio_chat_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/functions/portfolio_chat"
  output_path = "${path.module}/.build/portfolio_chat.zip"
}

resource "aws_lambda_function" "portfolio_chat" {
  function_name    = "${local.name_prefix}-portfolio-chat"
  role             = aws_iam_role.portfolio_chat_lambda.arn
  handler          = "app.handler"
  runtime          = "python3.12"
  timeout          = 60
  memory_size      = 256
  filename         = data.archive_file.portfolio_chat_lambda.output_path
  source_code_hash = data.archive_file.portfolio_chat_lambda.output_base64sha256

  environment {
    variables = {
      REQUESTS_TABLE   = aws_dynamodb_table.requests.name
      BEDROCK_MODEL_ID = var.bedrock_model_id
    }
  }
}

resource "aws_lambda_permission" "portfolio_chat_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.portfolio_chat.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}
