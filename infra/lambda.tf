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

  tags = local.common_tags
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

  tags = local.common_tags
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

  tags = local.common_tags
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
      REQUESTS_TABLE = aws_dynamodb_table.requests.name
      SESSIONS_TABLE = aws_dynamodb_table.sessions.name
    }
  }

  tags = local.common_tags
}
