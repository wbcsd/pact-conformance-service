/**
 * V2.3 Schema Definitions
 * 
 * This file extracts and converts OpenAPI v2.3 schemas to AJV-compatible JSON schemas.
 * The schemas are sourced from the authoritative OpenAPI specification file.
 * 
 * Source: /src/schemas/openapi_v2_3.yaml
 */

import { OpenApiSchemaExtractor } from '../utils/openApiSchemaExtractor';

// Create extractor instance for v2.3 OpenAPI specification
const openApiV2_3Extractor = new OpenApiSchemaExtractor('/home/gertjan/Projects/pact/pact-conformance-service/src/schemas/openapi_v2_3.yaml');

// Extract schemas from OpenAPI specification
export const v2_3_productFootprintSchema = openApiV2_3Extractor.createJsonSchemaWithDefinitions('ProductFootprint');

// Get all schemas for use in definitions
const allSchemas = openApiV2_3Extractor.getAllSchemas();

export const v2_3_ResponseSchema = {
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

export const v2_3_SingleFootprintResponseSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "SingleFootprintResponse",
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
export const v2_3_EventFulfilledSchema = openApiV2_3Extractor.createJsonSchemaWithDefinitions('RequestFulfilledEvent');
export const v2_3_EventRejectedSchema = openApiV2_3Extractor.createJsonSchemaWithDefinitions('RequestRejectedEvent');
export const v2_3_EventCreatedSchema = openApiV2_3Extractor.createJsonSchemaWithDefinitions('RequestCreatedEvent');
export const v2_3_EventPublishedSchema = openApiV2_3Extractor.createJsonSchemaWithDefinitions('PublishedEvent');

// Base event schema for reference
export const v2_3_BaseEventSchema = openApiV2_3Extractor.createJsonSchemaWithDefinitions('BaseEvent');

// Legacy exports for backward compatibility
export const eventFulfilledSchema = v2_3_EventFulfilledSchema;