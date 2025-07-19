# PACT Conformance Service - Lambda Functions
## Overview

The PACT API Test Service is a serverless application that provides conformance testing for PACT (Partnership for Carbon Transparency) API implementations. The service runs test cases against external API endpoints to validate conformance with PACT specifications across different versions (V2.0-V2.3 and V3.0).

## Lambda Functions Setup

The service consists of 5 main Lambda functions deployed using Terraform:

- **Runtime**: Node.js 22.x
- **Deployment**: All functions are packaged in a single `lambdas.zip` file
- **Database**: DynamoDB for storing test results and metadata
- **API Gateway**: HTTP API with specific routes for each function
- **Memory**: Varies by function (512MB - 1024MB)
- **Timeout**: 10 seconds (data retrieval) to 120 seconds (test execution)

## Lambda Functions Detailed Overview

### 1. runTestCases Lambda

**Route**: `POST /runTestCases`  
**Handler**: `dist/index.runTestCasesHandler`  
**Timeout**: 120 seconds  
**Memory**: 1024MB

This is the main orchestration function that executes the complete test suite against a target API.

**Key Responsibilities**:

- Validates input parameters (baseUrl, clientId, clientSecret, version, etc.)
- Authenticates with the target API using OAuth2 client credentials flow
- Fetches product footprints from the target API
- Generates appropriate test cases based on the PACT version (V2 or V3)
- Executes test cases sequentially
- Triggers asynchronous test cases via webhook
- Calculates test run metrics and overall pass/fail status
- Stores all results in DynamoDB

**Input Parameters**:

```json
{
  "baseUrl": "https://api.example.com",
  "clientId": "client_id",
  "clientSecret": "client_secret",
  "version": "V2.3",
  "companyName": "Test Company",
  "adminEmail": "admin@example.com",
  "adminName": "Admin User",
  "customAuthBaseUrl": "optional",
  "scope": "optional",
  "audience": "optional",
  "resource": "optional"
}
```

**Test Case Flow**:

1. Generate test cases based on version
2. Run synchronous test cases sequentially
3. Send webhook event for asynchronous test cases
4. Calculate metrics and update test run status

### 2. asyncRequestListener Lambda

**Routes**: `POST /2/events`, `POST /3/events`  
**Handler**: `dist/index.asyncRequestListenerHandler`  
**Timeout**: 10 seconds

This function acts as a webhook endpoint that receives callbacks from external systems during asynchronous testing. Specifically for test cases 13 (Asynchronous PCF Request) and 14 (Rejected PCF Request).

**Key Responsibilities**:

- Receives and validates webhook events (FULFILLED/REJECTED)
- Processes Test Case 13 (Asynchronous PCF Request) and Test Case 14 (Rejected PCF Request)
- Validates event schema using AJV
- Verifies correct API endpoint usage (/2/events vs /3/events)
- Updates test results in real-time
- Recalculates test run metrics after each async event

**Event Types Handled**:

- `FULFILLED`: Successful asynchronous PCF request completion
- `REJECTED`: Failed asynchronous PCF request with error details

**Validation Logic**:

- Schema validation against PACT specifications
- Product ID matching between request and response
- Correct endpoint path validation
- Error object validation for rejected events

### 3. getTestResults Lambda

**Route**: `GET /getTestResults?testRunId={id}`  
**Handler**: `dist/index.getTestResultsHandler`  
**Timeout**: 10 seconds

Retrieves comprehensive test results for a specific test run.

**Key Responsibilities**:

- Fetches test run data by testRunId
- Calculates passing percentages for mandatory and non-mandatory tests
- Returns formatted test results with metrics

**Response Format**:

```json
{
  "testRunId": "uuid",
  "results": [...],
  "passingPercentage": 85,
  "nonMandatoryPassingPercentage": 90,
  ...
}
```

### 4. getRecentTestRuns Lambda

**Route**: `GET /getRecentTestRuns?adminEmail={email}`  
**Handler**: `dist/index.getRecentTestRunsHandler`  
**Timeout**: 10 seconds

Retrieves recent test runs for a specific administrator.

**Key Responsibilities**:

- Queries DynamoDB for recent test runs by admin email
- Limits results to prevent excessive data retrieval
- Returns paginated test run summaries

**Query Parameters**:

- `adminEmail`: Filter test runs by administrator email

### 5. authForAsyncListener Lambda

**Route**: `POST /auth/token`  
**Handler**: `dist/index.authForAsyncListenerHandler`  
**Timeout**: 10 seconds

Provides OAuth2 authentication for systems that need to authenticate before sending webhook events.

**Key Responsibilities**:

- Validates Basic authentication credentials
- Issues JWT tokens for authenticated clients
- Uses hardcoded test credentials for conformance testing

**Authentication Flow**:

1. Validates Basic auth header
2. Checks against test credentials (`test_client_id` / `test_client_secret`)
3. Issues JWT token with 1-hour expiration

## Database Schema

The service uses DynamoDB with the following key patterns:

- **Test Runs**: Stored with `testRunId` as primary key
- **Test Results**: Nested within test run records
- **Test Data**: Metadata for async test correlation
- **Recent Test Runs**: Indexed by admin email for efficient querying


## Local Development and Testing


### Test Suite

Using the comprehensive test suite:

#### Unit Tests

Located in `src/__tests__/lambda/`, these tests cover:

- Individual Lambda function logic
- Business rule validation
- Error handling scenarios
- Schema validation
- Database operations (mocked)

**Run unit tests**:

```bash
npm test
```

**Run tests in watch mode**:

```bash
npm run test:watch
```

#### Integration Tests

The test suite includes integration tests that:

- Test Lambda functions with real AWS services (in test environment)
- Validate end-to-end workflows
- Test webhook handling and async operations
- Verify database interactions

**Key test files**:

- `asyncRequestListener.test.ts` - Tests webhook handling
- `runTestCases.test.ts` - Tests main orchestration logic
- `runTestCasesWithNock.test.ts` - Tests with mocked HTTP requests

#### Development Workflow

1. **Write/modify code** in TypeScript
2. **Run unit tests** to validate logic changes
3. **Use TypeScript compiler** to catch type errors early
4. **Run integration tests** locally
5. **Use CloudWatch logs** for debugging deployed functions

## Getting Started

1. **Prerequisites**: Ensure you have AWS CLI configured and Terraform installed
2. **Deploy Infrastructure**: Run `terraform apply` in the `infra/` directory
3. **Build and Package**: Run `npm run build` to compile TypeScript
4. **Deploy Functions**: Use the deployment script to package and upload Lambda functions
5. **Test Endpoints**: Use the provided API Gateway endpoints to trigger test runs

## Development Guidelines

- **TypeScript**: All Lambda functions are written in TypeScript for type safety
- **Testing**: Unit tests are located in `src/__tests__/lambda/`
- **Environment Variables**: Configuration is managed through Terraform variables
- **Logging**: Use structured logging with JSON format for CloudWatch
- **Error Handling**: Always return appropriate HTTP status codes and error messages
