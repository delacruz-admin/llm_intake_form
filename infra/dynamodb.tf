# ── DynamoDB Tables ─────────────────────────────────────────
#
# Two tables, split by access pattern per AWS best practices:
# - Chat sessions: append-only time-series messages, queried within a session
# - ARB requests: frequently updated records, queried by status/criticality
#
# See: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html

# Chat sessions + messages (high-volume, append-only)
resource "aws_dynamodb_table" "sessions" {
  name         = "${local.name_prefix}-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # PK: SESSION#<id>, SK: MSG#<timestamp> — chat messages
  # PK: SESSION#<id>, SK: FIELDS          — extracted intake fields

  point_in_time_recovery {
    enabled = true
  }

  tags = local.common_tags
}

# ARB requests + triage notes (low-volume, frequently queried/updated)
resource "aws_dynamodb_table" "requests" {
  name         = "${local.name_prefix}-requests"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  # PK: REQUEST#<id>, SK: META            — request record
  # PK: REQUEST#<id>, SK: NOTE#<ts>#<id>  — triage notes
  # GSI1PK: REQUESTS, GSI1SK: STATUS#<status>#<timestamp> — list/filter

  point_in_time_recovery {
    enabled = true
  }

  tags = local.common_tags
}


# ── S3 Bucket (Intake Attachments) ─────────────────────────

resource "aws_s3_bucket" "attachments" {
  bucket = "${local.name_prefix}-attachments-${data.aws_caller_identity.current.account_id}"
  tags   = local.common_tags
}

resource "aws_s3_bucket_versioning" "attachments" {
  bucket = aws_s3_bucket.attachments.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "attachments" {
  bucket = aws_s3_bucket.attachments.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET"]
    allowed_origins = ["*"]
    max_age_seconds = 3600
  }
}
