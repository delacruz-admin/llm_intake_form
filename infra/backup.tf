# ── AWS Backup — Daily backups, 7-day retention ────────────

resource "aws_backup_vault" "main" {
  name = "${local.name_prefix}-backup-vault"
}

resource "aws_backup_plan" "daily" {
  name = "${local.name_prefix}-daily-backup"

  rule {
    rule_name         = "daily-7day-retention"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 5 * * ? *)"  # Daily at 5:00 UTC

    lifecycle {
      delete_after = 7
    }
  }
}

resource "aws_iam_role" "backup" {
  name = "${local.name_prefix}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "backup_restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

resource "aws_backup_selection" "dynamodb_tables" {
  name         = "${local.name_prefix}-dynamodb-tables"
  iam_role_arn = aws_iam_role.backup.arn
  plan_id      = aws_backup_plan.daily.id

  resources = [
    aws_dynamodb_table.sessions.arn,
    aws_dynamodb_table.requests.arn,
  ]
}
