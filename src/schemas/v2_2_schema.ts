/**
 * V2.2 Schema Definitions
 * 
 * This file extracts and converts OpenAPI v2.2 schemas to AJV-compatible JSON schemas.
 * The schemas are sourced from the authoritative OpenAPI specification file.
 * 
 * Source: /src/schemas/openapi_v2_2.yaml
 */

import path from 'path';
import { OpenApiSchemaExtractor } from '../utils/openApiSchemaExtractor';

// Create extractor instance for v2.2 OpenAPI specification
const openApiExtractor = new OpenApiSchemaExtractor(
  path.join(__dirname, '../schemas/openapi_v2_2.yaml')
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

