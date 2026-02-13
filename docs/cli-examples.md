# CLI Testing Examples

## Basic Usage

Run V3.0 conformance tests:

```bash
npm run cli -- \
  --baseUrl https://api.example.com \
  --clientId your-client-id \
  --clientSecret your-client-secret \
  --version V3.0 \
  --organizationName "Your Organization"
```

## V2.2 Tests with Custom Auth

```bash
npm run cli -- \
  --baseUrl https://api.example.com \
  --customAuthBaseUrl https://auth.example.com \
  --clientId your-client-id \
  --clientSecret your-client-secret \
  --version V2.2 \
  --organizationName "Your Organization"
```

## With OAuth Parameters

```bash
npm run cli -- \
  --baseUrl https://api.example.com \
  --clientId your-client-id \
  --clientSecret your-client-secret \
  --version V3.0 \
  --organizationName "Your Organization" \
  --scope "read:footprints write:footprints" \
  --audience "https://api.example.com" \
  --adminEmail admin@example.com \
  --adminName "John Doe"
```

## Direct Execution (without npm)

```bash
npx ts-node src/scripts/run-tests-cli.ts \
  --baseUrl https://api.example.com \
  --clientId your-client-id \
  --clientSecret your-client-secret \
  --version V3.0 \
  --organizationName "Your Organization"
```

## Help

```bash
npm run cli -- --help
```

## Notes

- **No database required**: The CLI bypasses the database and displays results directly in the console
- **Exit codes**: Returns 0 if all mandatory tests pass, 1 if any fail
- **Callback tests**: Tests requiring callbacks (async tests) will show as PENDING when run from CLI
- **Colored output**: Success (green), failure (red), and pending (yellow) are color-coded
- **Timeouts**: Each test has a timeout configured in the application settings
