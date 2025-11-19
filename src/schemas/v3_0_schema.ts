/**
 * V3.0 Schema Definitions
 * 
 * This file extracts and converts OpenAPI v3.0 schemas to AJV-compatible JSON schemas.
 * The schemas are sourced from the authoritative OpenAPI specification file.
 * 
 * Source: /src/schemas/openapi_v3.yaml
 */

import path from 'path';
import { OpenApiSchemaExtractor } from '../utils/openApiSchemaExtractor';

const openApiExtractor = new OpenApiSchemaExtractor(
  path.join(__dirname, '../schemas/openapi_v3_0.yaml')
);

// Extract schemas from OpenAPI specification
export const productFootprintSchema = openApiExtractor.createJsonSchemaWithDefinitions('ProductFootprint');

// Get all schemas for use in definitions
const allSchemas = openApiExtractor.getAllSchemas();

export const ResponseSchema = {
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

export const SingleFootprintResponseSchema = {
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
export const EventFulfilledSchema = openApiExtractor.createJsonSchemaWithDefinitions('RequestFulfilledEvent');
export const EventRejectedSchema = openApiExtractor.createJsonSchemaWithDefinitions('RequestRejectedEvent');
export const EventCreatedSchema = openApiExtractor.createJsonSchemaWithDefinitions('RequestCreatedEvent');
export const EventPublishedSchema = openApiExtractor.createJsonSchemaWithDefinitions('PublishedEvent');

// Base event schema for reference
export const BaseEventSchema = openApiExtractor.createJsonSchemaWithDefinitions('BaseEvent');

