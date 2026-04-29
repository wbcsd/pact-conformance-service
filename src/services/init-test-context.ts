import { randomUUID } from "crypto";
import config from "../config";
import logger from "../utils/logger";
import { ValidationError } from "../errors";
import { TestRunStartParams, TestRun, TestRunStatus } from "./types";
import { fetchFootprints, getLinksHeaderFromFootprints } from "../utils/fetchFootprints";
import { getAccessToken, fetchOpenIdTokenEndpoint } from "../utils/authUtils";
import { getSchema } from "../schemas";
import { getFilterParameters } from "../test-cases/v3-test-cases";
import { TestContext } from "../test-cases/test-helpers";

export interface InitTestContextResult {
  testRun: TestRun;
  context: TestContext;
}

/**
 * Initializes a test context by performing all setup steps:
 * - URL normalization
 * - OpenID discovery / auth token endpoint resolution
 * - Access token acquisition
 * - Footprint fetching and pagination link extraction
 * - Schema loading and filter parameter computation
 *
 * Returns a TestRun record and a fully populated TestContext ready for test execution.
 */
export async function initTestContext(params: TestRunStartParams): Promise<InitTestContextResult> {
  if (!params.baseUrl || !params.clientId || !params.clientSecret) {
    throw new ValidationError("Missing required parameters: baseUrl, clientId, and clientSecret are mandatory.");
  }

  // Normalize URLs
  params.baseUrl = params.baseUrl.replace(/\/+$/, "").replace(/^https:/i, "https:");
  params.customAuthBaseUrl = params.customAuthBaseUrl?.replace(/\/+$/, "").replace(/^https:/i, "https:");

  const testRun: TestRun = {
    testRunId: randomUUID(),
    ...params,
    timestamp: new Date().toISOString(),
    techSpecVersion: params.version,
    status: TestRunStatus.FAIL,
    data: null,
  };

  logger.info(`Initializing test run ${testRun.testRunId} for organization ${params.organizationName}`);
  logger.info(`Test run parameters: ${JSON.stringify(params)}`);

  // Discover auth token endpoint via .well-known or fall back to /auth/token
  const authTokenUrl =
    (await fetchOpenIdTokenEndpoint(params.customAuthBaseUrl ?? params.baseUrl)) ??
    `${params.customAuthBaseUrl || params.baseUrl}/auth/token`;

  // Build auth request body
  const authRequestData = new URLSearchParams({
    grant_type: "client_credentials",
    ...(params.scope && { scope: params.scope }),
    ...(params.audience && { audience: params.audience }),
    ...(params.resource && { resource: params.resource }),
  }).toString();

  // Obtain access token
  const accessToken = await getAccessToken(
    authTokenUrl,
    params.clientId,
    params.clientSecret,
    authRequestData
  );

  // Fetch footprints and pagination links
  const footprints = await fetchFootprints(params.baseUrl, accessToken, params.version);
  const paginationLinks = await getLinksHeaderFromFootprints(
    params.baseUrl,
    accessToken,
    params.version
  );

  // Load schema and compute filter parameters
  const schema = await getSchema(params.version);
  const filterParams = getFilterParameters(footprints);

  // Store productIds on the test run
  testRun.data = { productIds: footprints.data[0].productIds };

  const context: TestContext = {
    testRunId: testRun.testRunId,
    baseUrl: params.baseUrl,
    authTokenUrl,
    accessToken,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    authRequestData,
    version: params.version,
    webhookUrl: config.CONFORMANCE_API,
    footprints,
    paginationLinks,
    schema,
    filterParams,
  };

  return { testRun, context };
}
