/**
 * V3.0 Schema Definitions
 * 
 * This file extracts and converts OpenAPI v3.0 schemas to AJV-compatible JSON schemas.
 * The schemas are sourced from the authoritative OpenAPI specification file.
 * 
 * Source: /src/schemas/openapi_v3.yaml
 */

import openApiExtractor from '../utils/openApiSchemaExtractor';

// Extract schemas from OpenAPI specification
export const v3_0_productFootprintSchema = openApiExtractor.createJsonSchemaWithDefinitions('ProductFootprint');

// Get all schemas for use in definitions
const allSchemas = openApiExtractor.getAllSchemas();

export const v3_0_ResponseSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ListFootprintsResponse",
  type: "object",
  required: ["data"],
  properties: {
    data: {
      type: "array",
      items: {
        $ref: "#/definitions/ProductFootprint"
      }
    }
  },
  definitions: allSchemas
};

export const V3_0_SingleFootprintResponseSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["data"],
  properties: {
    data: {
      $ref: "#/definitions/ProductFootprint"
    }
  },
  definitions: allSchemas
};

// Event schemas extracted from OpenAPI specification
export const v3_0_EventFulfilledSchema = openApiExtractor.createJsonSchemaWithDefinitions('RequestFulfilledEvent');
export const v3_0_EventRejectedSchema = openApiExtractor.createJsonSchemaWithDefinitions('RequestRejectedEvent');
export const v3_0_EventCreatedSchema = openApiExtractor.createJsonSchemaWithDefinitions('RequestCreatedEvent');
export const v3_0_EventPublishedSchema = openApiExtractor.createJsonSchemaWithDefinitions('PublishedEvent');

// Base event schema for reference
export const v3_0_BaseEventSchema = openApiExtractor.createJsonSchemaWithDefinitions('BaseEvent');

// Legacy exports for backward compatibility
export const productFootprintSchema = v3_0_productFootprintSchema;
export const listFootprintsResponseSchema = v3_0_ResponseSchema;
export const singleFootprintResponseSchema = V3_0_SingleFootprintResponseSchema;
export const requestFulfilledEventSchema = v3_0_EventFulfilledSchema;
export const requestRejectedEventSchema = v3_0_EventRejectedSchema;

// Additional event schema exports
export const requestCreatedEventSchema = v3_0_EventCreatedSchema;
export const publishedEventSchema = v3_0_EventPublishedSchema;
export const baseEventSchema = v3_0_BaseEventSchema;
