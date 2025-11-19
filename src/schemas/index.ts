/**
 * Unified Schema Registry
 * 
 * This file provides a structured way to access all schemas by version.
 * Instead of importing version-specific schema names, you can access them
 * through the schemas object: schemas['3.0'].singleFootprintResponse
 */

// Import all version-specific schemas
import * as v2_0 from "./v2_0_schema";
import * as v2_1 from "./v2_1_schema";
import * as v2_2 from "./v2_2_schema";
import * as v2_3 from "./v2_3_schema";
import * as v3_0 from "./v3_0_schema";

// Define the schema structure for each version
interface VersionSchema {
  productFootprint: any;
  listFootprintsResponse: any;
  singleFootprintResponse: any;
  events?: {
    fulfilled: any;
    rejected: any;
    created: any;
    published: any;
  };
}

export const authTokenResponseSchema = {
  type: "object",
  properties: {
    access_token: { type: "string" },
  },
  required: ["access_token"],
};

// Simple response schemas for general use
export const simpleResponseSchema = {
  type: "object",
  properties: {
    data: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  required: ["data"],
};

export const emptyResponseSchema = {
  type: "object",
  properties: {
    data: {
      type: "array",
      maxItems: 0,
      items: {
        type: "object",
      },
    },
  },
  required: ["data"],
};

export const simpleSingleFootprintResponseSchema = {
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },  
  },
  required: ["data"],
};

// Define the schemas object with version-based access
export const schemas: Record<string, VersionSchema> = {
  '2.0': {
    productFootprint: v2_0.productFootprintSchema,
    listFootprintsResponse: v2_0.ResponseSchema,
    singleFootprintResponse: v2_0.SingleFootprintResponseSchema,
  },
  '2.1': {
    productFootprint: v2_1.productFootprintSchema,
    listFootprintsResponse: v2_1.ResponseSchema,
    singleFootprintResponse: v2_1.SingleFootprintResponseSchema,
  },
  '2.2': {
    productFootprint: v2_2.productFootprintSchema,
    listFootprintsResponse: v2_2.ResponseSchema,
    singleFootprintResponse: v2_2.SingleFootprintResponseSchema,
  },
  '2.3': {
    productFootprint: v2_3.productFootprintSchema,
    listFootprintsResponse: v2_3.ResponseSchema,
    singleFootprintResponse: v2_3.SingleFootprintResponseSchema,
    events: {
      fulfilled: v2_3.EventFulfilledSchema,
      rejected: v2_3.EventRejectedSchema,
      created: v2_3.EventCreatedSchema,
      published: v2_3.EventPublishedSchema,
    },
  },
  '3.0': {
    productFootprint: v3_0.productFootprintSchema,
    listFootprintsResponse: v3_0.ResponseSchema,
    singleFootprintResponse: v3_0.SingleFootprintResponseSchema,
    events: {
      fulfilled: v3_0.EventFulfilledSchema,
      rejected: v3_0.EventRejectedSchema,
      created: v3_0.EventCreatedSchema,
      published: v3_0.EventPublishedSchema
    },
  },
};

// Helper function to get schema by version
export const getSchemaForVersion = (version: string): VersionSchema => {
  const normalizedVersion = version.replace(/^v/i, ''); // Remove 'v' prefix if present
  const schema = schemas[normalizedVersion];
  if (!schema) {
    throw new Error(`Schema for version ${version} not found. Available versions: ${Object.keys(schemas).join(', ')}`);
  }
  return schema;
};

// Helper functions for common schema access patterns
export const getProductFootprintSchema = (version: string) => {
  return getSchemaForVersion(version).productFootprint;
};

export const getListFootprintsResponseSchema = (version: string) => {
  return getSchemaForVersion(version).listFootprintsResponse;
};

export const getSingleFootprintResponseSchema = (version: string) => {
  return getSchemaForVersion(version).singleFootprintResponse;
};

export const getEventSchema = (version: string, eventType: 'fulfilled' | 'rejected' | 'created' | 'published') => {
  const schema = getSchemaForVersion(version);
  if (!schema.events) {
    throw new Error(`Events are not supported for version ${version}`);
  }
  return schema.events[eventType];
};

// Export type for TypeScript users
export type { VersionSchema };

// Export available versions
export const SUPPORTED_VERSIONS = Object.keys(schemas);