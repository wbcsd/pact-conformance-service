import { ApiVersion } from "../types";

export interface TestCase {
  name: string;
  callback?: boolean;
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint?: string;
  expectedStatusCodes?: number[];
  schema?: object;
  requestData?: any;
  condition?: (body: any, messages: string[]) => boolean;
  conditionErrorMessage?: string;
  headers?: Record<string, string>;
  customUrl?: string;
  mandatoryVersion?: ApiVersion[];
  testKey: string;
  documentationUrl?: string;
  expectHttpError?: boolean;
}
