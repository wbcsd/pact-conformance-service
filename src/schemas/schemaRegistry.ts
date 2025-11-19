/**
 * Unified Schema Registry
 * 
 * This file provides a structured way to access all schemas by version.
 * Instead of importing version-specific schema names, you can access them
 * through the schemas object: schemas['3.0'].singleFootprintResponse
 */

// Import all version-specific schemas
import {
  v2_0_ResponseSchema,
  v2_0_SingleFootprintResponseSchema,
  v2_0_productFootprintSchema,
} from "./v2_0_schema";
import {
  v2_1_ResponseSchema,
  v2_1_SingleFootprintResponseSchema,
  v2_1_productFootprintSchema,
} from "./v2_1_schema";
import {
  v2_2_ResponseSchema,
  v2_2_SingleFootprintResponseSchema,
  v2_2_productFootprintSchema,
} from "./v2_2_schema";
import {
  v2_3_ResponseSchema,
  v2_3_SingleFootprintResponseSchema,
  v2_3_productFootprintSchema,
  v2_3_EventFulfilledSchema,
  v2_3_EventRejectedSchema,
  v2_3_EventCreatedSchema,
  v2_3_EventPublishedSchema,
  v2_3_BaseEventSchema,
} from "./v2_3_schema";
import {
  v3_0_ResponseSchema,
  V3_0_SingleFootprintResponseSchema,
  v3_0_productFootprintSchema,
  v3_0_EventFulfilledSchema,
  v3_0_EventRejectedSchema,
  v3_0_EventCreatedSchema,
  v3_0_EventPublishedSchema,
  v3_0_BaseEventSchema,
} from "./v3_0_schema";

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
    base: any;
  };
}

// Define the schemas object with version-based access
export const schemas: Record<string, VersionSchema> = {
  '2.0': {
    productFootprint: v2_0_productFootprintSchema,
    listFootprintsResponse: v2_0_ResponseSchema,
    singleFootprintResponse: v2_0_SingleFootprintResponseSchema,
  },
  '2.1': {
    productFootprint: v2_1_productFootprintSchema,
    listFootprintsResponse: v2_1_ResponseSchema,
    singleFootprintResponse: v2_1_SingleFootprintResponseSchema,
  },
  '2.2': {
    productFootprint: v2_2_productFootprintSchema,
    listFootprintsResponse: v2_2_ResponseSchema,
    singleFootprintResponse: v2_2_SingleFootprintResponseSchema,
  },
  '2.3': {
    productFootprint: v2_3_productFootprintSchema,
    listFootprintsResponse: v2_3_ResponseSchema,
    singleFootprintResponse: v2_3_SingleFootprintResponseSchema,
    events: {
      fulfilled: v2_3_EventFulfilledSchema,
      rejected: v2_3_EventRejectedSchema,
      created: v2_3_EventCreatedSchema,
      published: v2_3_EventPublishedSchema,
      base: v2_3_BaseEventSchema,
    },
  },
  '3.0': {
    productFootprint: v3_0_productFootprintSchema,
    listFootprintsResponse: v3_0_ResponseSchema,
    singleFootprintResponse: V3_0_SingleFootprintResponseSchema,
    events: {
      fulfilled: v3_0_EventFulfilledSchema,
      rejected: v3_0_EventRejectedSchema,
      created: v3_0_EventCreatedSchema,
      published: v3_0_EventPublishedSchema,
      base: v3_0_BaseEventSchema,
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

export const getEventSchema = (version: string, eventType: 'fulfilled' | 'rejected' | 'created' | 'published' | 'base') => {
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