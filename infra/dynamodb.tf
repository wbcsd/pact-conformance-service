resource "aws_dynamodb_table" "run_test_cases_table" {
  name         = "${var.environment}_TestRunTable"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "testId"
  range_key    = "SK"

  attribute {
    name = "testId"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "adminEmail"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  global_secondary_index {
    name            = "adminEmail-timestamp-index"
    hash_key        = "adminEmail"
    range_key       = "timestamp"
    projection_type = "ALL"
  }
}
