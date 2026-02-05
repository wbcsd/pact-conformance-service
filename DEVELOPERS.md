# PACT Conformance Service - Developer Setup Guide

## Prerequisites

### Required Software

1. **Node.js** (version 18 or higher)

   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version` and `npm --version`

2. **npm** (usually comes with Node.js)

   - Verify installation: `npm --version`

3. **Docker & Docker Compose** (for local PostgreSQL database)

   - Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   - Verify installation: `docker --version` and `docker-compose --version`

4. **Git** (for version control)
   - Most systems have this pre-installed
   - Verify: `git --version`

### Recommended Tools

- **Visual Studio Code** with extensions:
  - TypeScript and JavaScript Language Features
  - Jest Runner
  - REST Client (for testing endpoints)
- **Postman** or **Insomnia** for API testing
- **VS Code Rest Client** extension for using `routes.rest` file

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

- TypeScript for development
- Jest for testing
- Express for the development server
- PostgreSQL driver
- AJV for JSON schema validation

### 3. Start Local Database

Copy the example environment file and edit if necessary.

```bash
cp .env.example .env
```

Start the PostgreSQL database using Docker Compose:

```bash
docker-compose up -d
```

This starts a PostgreSQL database container with:
- Host: `localhost`
- Port: `5433`
- Database: `pact-conformance-db`
- User: `postgres`
- Password: `postgres`

To stop the database:

```bash
docker-compose down
```

### 4. Run Database Migrations

The database migrations are automatically applied when the server starts. To manually run migrations:

```bash
npm run migrate
```

## Development Environment

### Code Structure

```
src/
├── services/            # Core business logic
├── utils/               # Utility functions
├── test-cases/          # Test case generators (v2, v3)
├── schemas/             # JSON schemas and OpenAPI specs
├── data/                # Database models and migrations
├── middleware/          # Express middleware
├── config.ts            # Configuration management
├── server.ts            # Express server
└── errors.ts            # Error definitions
```

### Available Scripts

```bash
# Development
npm start               # Start local development server
npm run dev             # Start with auto-reload using ts-node-dev
npm run build           # Compile TypeScript to JavaScript

# Testing
npm test                # Run all tests
npm test -- --watch     # Run tests in watch mode
npm test -- --coverage  # Run tests with coverage report

# Database
npm run migrate         # Run pending database migrations
```

### Local Development Server

Start the development server:

```bash
npm start
```

The server runs on `http://localhost:8004` (or the port specified in your environment).

**Available endpoints** (see [routes.rest](routes.rest) for examples):

- `POST /testruns` - Create and run test cases
- `GET /testruns/:id` - Get test run results
- `GET /testruns` - List test runs
- `POST /2/events` - v2 webhook events
- `POST /2/events` - v3 webhook events
- `POST /auth/token` - Generate authentication tokens

## Testing Strategy

### Running Tests

Run the full test suite:

```bash
npm test
```

Run tests in watch mode (re-runs on file changes):

```bash
npm test -- --watch
```

Run tests with coverage report:

```bash
npm test -- --coverage
```

Run a specific test file:

```bash
npm test -- src/services/test-run-repository.test.ts
```

### Test Files

Test files are located throughout the `src/` directory alongside their corresponding implementation files:

- `src/services/event-handler.test.ts` - Event handling tests
- `src/services/test-run-repository.test.ts` - Database operation tests
- `src/services/test-run-worker.test.ts` - Test execution worker tests
- `src/utils/runTestCase.test.ts` - Test case execution tests

### Writing Tests

The project uses Jest for testing. When adding new features:

1. Create a `.test.ts` file alongside your implementation file
2. Import the function or class you're testing
3. Use Jest's `describe()` and `test()` functions
4. Mock external dependencies (database, HTTP calls, etc.)

Example test:

```typescript
import { TestRunRepository } from "./test-run-repository";

describe("TestRunRepository", () => {
  test("should create a new test run", async () => {
    const repository = new TestRunRepository();
    const result = await repository.create({
      // test data
    });
    expect(result.id).toBeDefined();
  });
});
```

## TypeScript Configuration

The project uses strict TypeScript configuration (`tsconfig.json`):

- **Target**: ES2020
- **Module**: CommonJS
- **Strict mode**: Enabled (null checks, type safety)
- **Source maps**: Generated for debugging
- **Output directory**: `dist/`

Build the project:

```bash
npm run build
```

Check for TypeScript errors without building:

```bash
npx tsc --noEmit
```

## Database

### PostgreSQL

The project uses PostgreSQL for data storage. Configuration is handled in [src/config.ts](src/config.ts), see `.env.example` for relevant environment variables.

### Database Schema

Schema is managed through migrations in `src/data/migrations/`:

- `2025-09-02-init.ts` - Initial schema setup
- `2025-10-09-guids-and-organizations.ts` - Organization support

Migrations are run automatically on server start. To manually run migrations:

```bash
npm run migrate
```

### Key Tables

- `test_runs` - Test runs, contain multiple test case results.
- `test_results` - Individual test case results, all linked to a test run.
- `test_data` - Additional test data linked to a test run.

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

5. **Test locally**:

   ```bash
   npm start
   # Use routes.rest or Postman to test endpoints
   ```

6. **Build the project**:

   ```bash
   npm run build
   ```

### Code Quality

- Use TypeScript strict mode
- Write tests for new features
- Follow existing code style
- Run all tests before committing

## Debugging

### Local Server

- Use `console.log()` for quick debugging
- VS Code debugger with breakpoints
- Check server output in terminal

### Database

```bash
# Connect to local database
docker exec -it pact-conformance-db psql -U postgres -d pact-conformance-db

# View tables
\dt

# Query data
SELECT * FROM test_runs;
```

### Testing Endpoints

Use the [routes.rest](routes.rest) file with VS Code REST Client extension, or use curl:

```bash
curl -X POST http://localhost:8004/testruns \
  -H "Content-Type: application/json" \
  -d '{"provider": "example", "consumer": "test"}'
```

## Troubleshooting

### Common Issues

**TypeScript Compilation Errors**:

```bash
npx tsc --noEmit
```

**Test Failures**:

```bash
npm test -- --verbose
```

**Server won't start**:

- Check port 8004 is not in use: `lsof -i :8004`
- Verify database is running: `docker-compose ps`
- Check logs: `docker-compose logs postgres`

**Database connection errors**:

- Ensure PostgreSQL container is running: `docker-compose up -d`
- Verify connection string in environment
- Check database exists: `docker exec -it pact-conformance-db psql -U postgres -l`

**Tests failing**:

- Run migrations: `npm run migrate`
- Clear database and restart: `docker-compose down && docker-compose up -d`

## Next Steps

1. **Clone and set up**: Follow the [Project Setup](#project-setup) section
2. **Start the server**: Run `npm start`
3. **Run tests**: Execute `npm test` to verify everything works
4. **Explore endpoints**: Use [routes.rest](routes.rest) to test the API
5. **Read test cases**: Review [docs/v3-test-cases-expected-results.md](docs/v3-test-cases-expected-results.md)

Welcome to the PACT Conformance Service development team!
