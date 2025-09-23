import Ajv from "ajv";
import addFormats from "ajv-formats";
import betterErrors from "ajv-errors";
import {
  ApiVersion,
  TestCase,
  TestResult,
  TestCaseResultStatus,
} from "../types/types";
import logger from "./logger";

// Setup timeout for the fetch request
const DEFAULT_FETCH_TIMEOUT_MS = parseInt(
  process.env.FETCH_TIMEOUT_MS || "5000",
  10
);

const isMandatoryVersion = (testCase: TestCase, version: ApiVersion) => {
  if (testCase.mandatoryVersion) {
    return testCase.mandatoryVersion.includes(version);
  }
  return false;
};

/**
 * Generates a curl command representation of the HTTP request
 */
const generateCurlCommand = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): string => {
  let curlCmd = `curl -X ${method} '${url}'`;

  // Add headers
  for (const [key, value] of Object.entries(headers)) {
    curlCmd += ` -H '${key}: ${value}'`;
  }

  // Add request body if present
  if (body) {
    curlCmd += ` -d '${body}'`;
  }

  return curlCmd;
};

/**
 * Runs an individual test case against the API.
 * Validates both the HTTP status and the JSON response against a provided schema.
 */
export const runTestCase = async (
  baseUrl: string,
  testCase: TestCase,
  accessToken: string,
  version: ApiVersion
): Promise<TestResult> => {

  // Determine the full URL for the request
  const url = testCase.customUrl || `${baseUrl}${testCase.endpoint}`;

  // Determine headers and body for curl command generation
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...testCase.headers,
  };

  // Create the request body 
  const body = typeof testCase.requestData === "string"
    ? testCase.requestData
    : JSON.stringify(testCase.requestData);

  // Initialize the result object with default values
  let result: TestResult = {
    name: testCase.name,
    mandatory: isMandatoryVersion(testCase, version),
    testKey: testCase.testKey,
    status: TestCaseResultStatus.SUCCESS, // Assume success, will change if any checks fail
    curlRequest: generateCurlCommand(url, testCase.method, headers, body),
    documentationUrl: testCase.documentationUrl,
  };

  // If this is a callback test case, the call will need to made by the tested API.
  // That call is going to be handled by our Event listener, see EventController.
  // We return the TestResult with PENDING status here.
  if (testCase.callback) {
    result.status = TestCaseResultStatus.PENDING;
    headers.Authorization = `Bearer YOUR-TOKEN-HERE`;
    // Generate curl command with placeholder token for documentation
    result.curlRequest = generateCurlCommand(url, testCase.method, headers, body);
    return result;
  }
  
  let status = 0;
  let text = null;
  let data = null;

  try {
    const response = await fetch(url, {
      method: testCase.method,
      body: body,
      headers: headers,
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    });
    status = response.status;
    text = await response.text();
    if (text && response.headers.get("Content-Type")?.includes("application/json")) {
      data = JSON.parse(text);
    }
  }
  catch (error: any) {
    if (error.name === "AbortError"){
      result.errorMessage = `Request timeout after ${DEFAULT_FETCH_TIMEOUT_MS}ms`;
    } else {
      result.errorMessage = error.message;
    }
    if (testCase.expectHttpError) {
      result.status = TestCaseResultStatus.SUCCESS;
    } else {
      result.status = TestCaseResultStatus.FAILURE;
    }
    return result;
  }

  if (testCase.expectHttpError) {
    if (status >= 200 && status < 300) {
      result.errorMessage = `Expected HTTP error, but got ${status}`;
    } else {
      result.status = TestCaseResultStatus.SUCCESS;
    }
    return result;
  }

  result.apiResponse = JSON.stringify(data);
  
  if (testCase.expectedStatusCodes && !testCase.expectedStatusCodes.includes(status)) {
    result.status = TestCaseResultStatus.FAILURE;
    result.errorMessage = `Expected status [${testCase.expectedStatusCodes.join(", ")}], but got ${status}`;
    return result;
  }
  
  if (testCase.schema) {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    betterErrors(ajv);
    const validate = ajv.compile(testCase.schema);
    if (!validate(data)) {
      logger.info(
        "Schema validation failed:",
        validate.errors?.map((e) => e.message).join(", ") as any
      );
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = `Schema validation failed: ${JSON.stringify(validate.errors)}`;
      return result;
    }
  }

  // Run condition if provided
  if (typeof testCase.condition === "function") {
    let messages:string[] = [];
    if (!testCase.condition(data, messages)) {
      result.status = TestCaseResultStatus.FAILURE;
      if (testCase.conditionErrorMessage) {
        messages.push(testCase.conditionErrorMessage);
      }
    } else {
      result.status = TestCaseResultStatus.SUCCESS;
    }
    result.errorMessage = messages.join(", ");
  }

  return result;
};
