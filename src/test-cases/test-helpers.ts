import Ajv from "ajv";
import addFormats from "ajv-formats";
import betterErrors from "ajv-errors";
import config from "../config";
import { ApiVersion, TestCaseResultStatus, TestResult } from "../services/types";

export interface TestContext {
  testRunId: string;
  baseUrl: string;
  authTokenUrl: string;
  accessToken: string;
  headers: Record<string, string>;
  clientId: string;
  clientSecret: string;
  authRequestData: string;
  version: ApiVersion;
  webhookUrl: string;
  footprints: any;
  paginationLinks: Record<string, string>;
  schema: any;
  filterParams: any;
}

export const createTest = (
  testName: string,
  url: string,
  testFn: (ctx: TestContext) => Promise<Partial<TestResult> | void>
) => {
  return async (ctx: TestContext): Promise<TestResult> => {
    const result: TestResult = {
      name: testName,
      status: TestCaseResultStatus.SUCCESS,
      mandatory: true,
      testKey: testName.toUpperCase().replace(/^TEST CASE (\d+)/, "TESTCASE#$1"),
      documentationUrl: url,
    };

    try {
      const extra = await testFn(ctx);
      if (extra && typeof extra === "object") {
        if ("apiResponse" in extra) {
          result.apiResponse = extra.apiResponse;
        }
        if ("status" in extra && extra.status) {
          result.status = extra.status;
        }
        if ("errorMessage" in extra && extra.errorMessage) {
          result.errorMessage = extra.errorMessage;
        }
        if ("mandatory" in extra && typeof extra.mandatory === "boolean") {
          result.mandatory = extra.mandatory;
        }
      }
      return result;
    } catch (error: any) {
      result.status = TestCaseResultStatus.FAILURE;
      result.errorMessage = error.message;
      return result;
    }
  };
};

export const makeRequest = async (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ status: number; data: any; text: string }> => {
  const response = await fetch(url, {
    method,
    body,
    headers,
    signal: AbortSignal.timeout(config.TESTCASE_TIMEOUT),
  });

  const text = await response.text();
  let data = null;

  if (text && response.headers.get("Content-Type")?.includes("application/json")) {
    data = JSON.parse(text);
  }

  return { status: response.status, data, text };
};

export const assert = (condition: boolean, failureMessage: string): void => {
  if (!condition) {
    throw new Error(failureMessage);
  }
};

export const assertStatus = (
  status: number,
  expectedStatus: number | number[]
): void => {
  if (Array.isArray(expectedStatus)) {
    assert(
      expectedStatus.includes(status),
      `Expected status ${expectedStatus.join(", ")}, but got ${status}`
    );
  } else {
    assert(
      status === expectedStatus,
      `Expected status ${expectedStatus}, but got ${status}`
    );
  }
};

const validateSchema = (data: any, schema: any): { valid: boolean; errors?: string } => {
  if (!schema) return { valid: true };

  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  betterErrors(ajv);
  const validate = ajv.compile(schema);

  if (!validate(data)) {
    return {
      valid: false,
      errors: validate.errors?.map((e) => e.message).join(", "),
    };
  }

  return { valid: true };
};

export const assertSchema = (data: any, schema: any): void => {
  const schemaValidation = validateSchema(data, schema);
  assert(
    schemaValidation.valid,
    `Schema validation failed: ${schemaValidation.errors ?? "Unknown error"}`
  );
};

