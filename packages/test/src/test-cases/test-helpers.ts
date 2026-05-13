import Ajv from "ajv";
import addFormats from "ajv-formats";
import betterErrors from "ajv-errors";

export const assert = (condition: boolean, failureMessage: string): void => {
  if (!condition) {
    throw new Error(failureMessage);
  }
};

export const assertIncluded = <T>(value: T, expected: T[] | T): void => {
  const array = Array.isArray(expected) ? expected : [expected];
  if (!array.includes(value)) {
    throw new Error(`Expected [${array}] but received value ${value}`);
  }
};

export const assertStatus = assertIncluded<number>;

export const assertNotNull = (value: any, failureMessage: string) => {
  if (value === null || value === undefined || value === "" || !!value === false) {
    throw new Error(failureMessage);
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

/**
 * Parses an RFC 5988 Link header into a map of `rel` values to URLs.
 */
export const parseLinkHeader = (header: string | null): Record<string, string> => {
  if (!header) return {};

  return header.split(", ").reduce<Record<string, string>>((acc, link) => {
    const match = link.match(/<(.*)>;\s*rel="(.*)"/);
    if (match) {
      acc[match[2]] = match[1];
    }
    return acc;
  }, {});
};

export const randomString = (length: number) => {
  const variation =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let string = "";
  for (let i = 0; i < length; i++) {
    string += variation[Math.floor(Math.random() * variation.length)];
  }
  return string;
};

export const getIncorrectAuthHeaders = (url: string) => {
  const incorrectUserName = randomString(16);
  const incorrectPassword = randomString(16);
  const host = new URL(url).hostname;
  return {
    host,
    accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization:
      "Basic " +
      Buffer.from(incorrectUserName + ":" + incorrectPassword).toString("base64"),
  };
};

export const getCorrectAuthHeaders = (
  url: string,
  clientId: string,
  clientSecret: string
) => {
  const host = new URL(url).hostname;
  return {
    host,
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization:
      "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
  };
};
