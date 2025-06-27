# PACT Conformance Service - Developer Setup Guide

## Prerequisites

### Required Software

1. **Node.js** (version 18 or higher)

   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version` and `npm --version`

2. **TypeScript** (globally installed)

   ```bash
   npm install -g typescript
   ```

   Or use `npx` to run TypeScript commands without global install:

   ```bash
   npx tsc --version
   ```

3. **Docker & Docker Compose** (for local PostgreSQL database)

   - Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   - Verify installation: `docker --version` and `docker-compose --version`

4. **AWS CLI** (for deployment and AWS services)

   - Install: [AWS CLI Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
   - Configure: `aws configure` with your AWS credentials

5. **Terraform** (for infrastructure deployment)

   - Install: [Terraform Installation Guide](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli)
   - Verify installation: `terraform --version`

6. **Git** (for version control)
   - Most systems have this pre-installed
   - Verify: `git --version`

### Optional Tools

- **Visual Studio Code** with extensions:
  - TypeScript and JavaScript Language Features
  - AWS Toolkit
  - Terraform
  - Jest Runner
- **Postman** or **Insomnia** for API testing

## Project Setup

### 1. Clone the Repository

```bash
git clone git@github.com:wbcsd/pact-conformance-service.git
cd pact-conformance-service
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages including:

- TypeScript and development tools
- AWS SDK for DynamoDB and Lambda
- Jest for testing
- Express for local development server
- AJV for JSON schema validation

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` file with your local configuration:

```bash
PORT=8004
DATABASE_TYPE=postgres
DATABASE_NAME=pact_conformance_db
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
POSTGRES_CONNECTION_STRING=postgres://postgres:postgres@localhost:5433/pact-conformance-db
```

**Note**: The Lambda functions use DynamoDB in production, but the local development server can use PostgreSQL for testing database operations.

### 4. Start Local Database (Optional)

For local development server testing (not Lambda testing):

```bash
docker-compose up -d
```

This starts a PostgreSQL database container on port 5433.

To stop the database:

```bash
docker-compose down
```

## Development Environment

### Code Structure

```
src/
├── lambda/              # Lambda function handlers
├── utils/              # Shared utilities
├── test-cases/         # Test case generators
├── schemas/            # JSON schemas and OpenAPI specs
├── types/              # TypeScript type definitions
├── data/               # Database adapters and interfaces
├── __tests__/          # Test files
├── config.ts           # Configuration management
├── server.ts           # Local Express server
└── index.ts            # Lambda handler exports
```

### Available Scripts

```bash
# Development
npm run dev              # Start local Express server with hot reload
npm run build           # Compile TypeScript to JavaScript

# Testing
npm test                # Run all tests (unit + integration)
npm run test:watch      # Run tests in watch mode

# Deployment
./deploy.sh             # Build and deploy to AWS (requires AWS credentials)
```

### Local Development Server

The project includes an Express server that wraps the Lambda functions for local testing:

```bash
npm run dev
```

This starts a server on `http://localhost:8004` with the following endpoints:

- `POST /runTestCases` - Execute test suite
- `GET /getTestResults?testRunId=<id>` - Retrieve test results
- `GET /getRecentTestRuns?adminEmail=<email>` - Get recent test runs
- `POST /2/events` - Webhook endpoint for v2 events
- `POST /3/events` - Webhook endpoint for v3 events
- `POST /auth/token` - Authentication endpoint

**Important**: This local server is for development convenience only. The actual production system uses AWS Lambda functions deployed via API Gateway.

## Testing Strategy

### Unit Tests

Run individual function tests:

```bash
npm test
```

Test files are located in `src/__tests__/lambda/`:

- `asyncRequestListener.test.ts` - Tests webhook handling
- `runTestCases.test.ts` - Tests main orchestration
- `runTestCasesWithNock.test.ts` - Tests with HTTP mocking

### Test Configuration

Jest is configured in `package.json`:

- Uses `ts-jest` preset for TypeScript support
- Runs tests with `--maxWorkers=1` for sequential execution
- Test environment: Node.js

### Writing Tests

When adding new functionality:

1. **Unit Tests**: Test individual functions in isolation
2. **Integration Tests**: Test Lambda functions with mocked AWS services
3. **Mocking**: Use `nock` for HTTP request mocking
4. **Database Mocking**: Mock DynamoDB operations for unit tests

Example test structure:

```typescript
import { handler } from "../lambda/functionName";

describe("Lambda Function Tests", () => {
  test("should handle valid input", async () => {
    const event = {
      /* mock event */
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });
});
```

## TypeScript Configuration

The project uses strict TypeScript configuration:

- **Target**: ES2020
- **Module**: CommonJS
- **Strict mode**: Enabled
- **Source maps**: Generated for debugging
- **Output directory**: `dist/`

Key TypeScript features used:

- Strict null checks
- Type definitions for AWS Lambda
- Interface definitions for API contracts
- Enum types for constants

## AWS Services Integration

### DynamoDB

The Lambda functions interact with DynamoDB:

- **Table**: Configured via Terraform
- **SDK**: Uses AWS SDK v3 (`@aws-sdk/client-dynamodb`)
- **Operations**: Put, Get, Query, Update operations
- **Local Testing**: Use DynamoDB Local or mocked operations

### API Gateway

HTTP API with Lambda proxy integration:

- **Routes**: Defined in `infra/api.tf`
- **CORS**: Configured for cross-origin requests
- **Authentication**: Bearer token for some endpoints
- **Logging**: CloudWatch integration

### Lambda Functions

Runtime configuration:

- **Runtime**: Node.js 22.x
- **Memory**: 512MB - 1024MB depending on function
- **Timeout**: 10s - 120s depending on complexity
- **Environment**: Variables set via Terraform

## Development Workflow

### Making Changes

1. **Create feature branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make code changes** in TypeScript

3. **Run type checking**:

   ```bash
   npx tsc --noEmit
   ```

4. **Run tests**:

   ```bash
   npm test
   ```

5. **Test locally** (if applicable):

   ```bash
   npm run dev
   # Test endpoints with Postman/curl
   ```

6. **Build the project**:
   ```bash
   npm run build
   ```

### Debugging

**Local Development**:

- Use `console.log()` statements
- VS Code debugger with breakpoints
- Express server request/response logging

**AWS Lambda**:

- CloudWatch Logs for deployed functions
- AWS X-Ray for distributed tracing
- API Gateway access logs
- DynamoDB CloudWatch metrics

## Deployment

The project uses GitHub Actions for CI/CD with automated deployments to both development and production environments.

### GitHub Actions CI/CD Pipeline

#### Development Deployment (Automatic)

**Trigger**: Automatic deployment on every push to `main` branch

**Workflow**: `.github/workflows/deploy-dev.yml`

The development pipeline:
1. **Setup**: Checks out code and sets up Node.js 20
2. **Dependencies**: Installs packages with `npm ci`
3. **Testing**: Runs the complete test suite (`npm test`)
4. **Build**: Compiles TypeScript to JavaScript
5. **Package**: Creates `lambdas.zip` with compiled code and dependencies
6. **Deploy**: Uses Terraform to deploy infrastructure and Lambda functions

**Environment**: 
- **Region**: `eu-north-1` (Stockholm)
- **Backend**: S3 state storage with DynamoDB locking
- **Webhook URL**: `https://conformance.services.dev.carbon-transparency.org`

#### Production Deployment (Manual)

**Trigger**: Manual workflow dispatch from GitHub Actions UI

**Workflow**: `.github/workflows/deploy-prod.yml`

The production pipeline follows the same steps as development but:
- **No automatic testing** (assumes tests passed in dev)
- **Manual approval** required via GitHub UI
- **Production configuration** with prod webhook URL
- **Webhook URL**: `https://conformance.services.carbon-transparency.org`

#### Required GitHub Secrets

The following secrets must be configured in GitHub repository settings:

```
AWS_ACCESS_KEY_ID       # AWS access key for deployment
AWS_SECRET_ACCESS_KEY   # AWS secret key for deployment
```

### Local Development Deployment

For local development and testing:

```bash
# Build and deploy to dev environment
./deploy.sh
```

This script:
1. Compiles TypeScript to JavaScript
2. Creates `lambdas.zip` with compiled code and dependencies
3. Applies Terraform configuration to AWS
4. Updates Lambda functions with new code

### Prerequisites for Deployment

1. **AWS Credentials**: Configure via `aws configure` or environment variables
2. **Terraform Backend**: S3 bucket for state storage (`api-test-service-terraform-state-bucket`)
3. **IAM Permissions**: Sufficient permissions for Lambda, API Gateway, DynamoDB
4. **GitHub Secrets**: AWS credentials configured in repository settings

### Environment Configuration Files

- `infra/dev.tfvars` - Development environment variables
- `infra/prod.tfvars` - Production environment variables
- `infra/backend-dev.hcl` - Development Terraform backend configuration
- `infra/backend-prod.hcl` - Production Terraform backend configuration

### Deployment Flow

#### Development
```
Push to main → GitHub Actions → Tests → Build → Deploy to Dev
```

#### Production  
```
Manual Trigger → GitHub Actions → Build → Deploy to Prod
```

### Infrastructure Components

Both environments deploy:
- **Lambda Functions**: All 5 functions with appropriate memory/timeout settings
- **API Gateway**: HTTP API with route configurations
- **DynamoDB**: Test results and metadata storage
- **IAM Roles**: Execution roles with necessary permissions
- **CloudWatch**: Logging and monitoring

## Troubleshooting

### Common Issues

**TypeScript Compilation Errors**:

```bash
npx tsc --noEmit  # Check for type errors
```

**Test Failures**:

```bash
npm test -- --verbose  # Run tests with detailed output
```

**Local Server Issues**:

- Check port 8004 is not in use
- Verify environment variables are set
- Ensure PostgreSQL container is running (if using local DB)

**AWS Deployment Issues**:

- Verify AWS credentials: `aws sts get-caller-identity`
- Check Terraform state: `terraform plan` in `infra/` directory
- Review CloudWatch logs for Lambda function errors

### Getting Help

1. **Documentation**: Check `docs/` directory for additional guides
2. **Issues**: Create GitHub issue for bugs or feature requests
3. **Team Chat**: Reach out to team members for development questions
4. **AWS Documentation**: Reference AWS Lambda and API Gateway docs

## Next Steps

Once you have the development environment set up:

1. **Read the onboarding documentation**: Review `docs/onboarding.md` for architecture overview
2. **Explore the codebase**: Start with `src/lambda/runTestCases.ts` for the main workflow
3. **Run the test suite**: Ensure all tests pass in your environment
4. **Try local development**: Start the Express server and test endpoints
5. **Deploy to development**: Use `./deploy.sh` to deploy your first changes

Welcome to the PACT API Test Service development team! 🚀
