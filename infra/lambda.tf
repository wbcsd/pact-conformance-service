resource "aws_lambda_function" "run_test_cases" {
  function_name    = "${var.environment}_runTestCases"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "dist/index.runTestCasesHandler"
  runtime          = "nodejs22.x"
  filename         = "../lambdas.zip"
  timeout          = 30
  source_code_hash = filebase64sha256("../lambdas.zip")
  memory_size      = 1024

  environment {
    variables = {
      DATABASE_TYPE       = "dynamodb"
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.run_test_cases_table.name
      WEBHOOK_URL         = "${aws_apigatewayv2_api.http_api.api_endpoint}/2/events"
    }
  }
}

resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.run_test_cases.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# TODO delete this resource
resource "aws_lambda_permission" "run_test_cases_invoke" {
  statement_id  = "AllowAPIGatewayInvokeRunTestCases"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.run_test_cases.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/POST/runTestCases"
}

# AsyncRequestListener Lambda Function
resource "aws_lambda_function" "async_request_listener" {
  function_name    = "${var.environment}_asyncRequestListener"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "dist/index.asyncRequestListenerHandler"
  runtime          = "nodejs22.x"
  filename         = "../lambdas.zip"
  timeout          = 10
  source_code_hash = filebase64sha256("../lambdas.zip")

  environment {
    variables = {
      DATABASE_TYPE       = "dynamodb"
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.run_test_cases_table.name
    }
  }
}

# Permission for API Gateway to invoke asyncRequestListener Lambda
resource "aws_lambda_permission" "async_request_listener_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.async_request_listener.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# Lambda Function for authForAsyncListener
resource "aws_lambda_function" "auth_for_async_listener" {
  function_name    = "${var.environment}_authForAsyncListener"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "dist/index.authForAsyncListenerHandler"
  runtime          = "nodejs22.x"
  filename         = "../lambdas.zip"
  timeout          = 10
  source_code_hash = filebase64sha256("../lambdas.zip")
}

# Permission for API Gateway to invoke authForAsyncListener Lambda
resource "aws_lambda_permission" "auth_for_async_listener_invoke" {
  statement_id  = "AllowAPIGatewayInvokeAuthForAsyncListener"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_for_async_listener.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# GetTestResults Lambda Function
resource "aws_lambda_function" "get_test_results" {
  function_name    = "${var.environment}_getTestResults"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "dist/index.getTestResultsHandler"
  runtime          = "nodejs22.x"
  filename         = "../lambdas.zip"
  timeout          = 10
  source_code_hash = filebase64sha256("../lambdas.zip")

  environment {
    variables = {
      DATABASE_TYPE       = "dynamodb"
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.run_test_cases_table.name
    }
  }
}

# Permission for API Gateway to invoke getTestResults Lambda
resource "aws_lambda_permission" "get_test_results_invoke" {
  statement_id  = "AllowAPIGatewayInvokeGetTestResults"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_test_results.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# GetRecentTestRuns Lambda Function
resource "aws_lambda_function" "get_recent_test_runs" {
  function_name    = "${var.environment}_getRecentTestRuns"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "dist/index.getRecentTestRunsHandler"
  runtime          = "nodejs22.x"
  filename         = "../lambdas.zip"
  timeout          = 10
  source_code_hash = filebase64sha256("../lambdas.zip")

  environment {
    variables = {
      DATABASE_TYPE       = "dynamodb"
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.run_test_cases_table.name
    }
  }
}

# Permission for API Gateway to invoke getRecentTestRuns Lambda
resource "aws_lambda_permission" "get_recent_test_runs_invoke" {
  statement_id  = "AllowAPIGatewayInvokeGetRecentTestRuns"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_recent_test_runs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
