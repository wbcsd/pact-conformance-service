import path from 'path';
import { OpenApiSchemaExtractor } from '../utils/openApiSchemaExtractor';

// Define the schema structure for each version
export interface VersionSchema {
  productFootprint: any;
  listFootprintsResponse: any;
  singleFootprintResponse: any;
  authTokenResponseSchema: any;
  simpleResponseSchema: any;
  emptyResponseSchema: any;
  simpleSingleFootprintResponseSchema: any;
  events?: {
    fulfilled: any;
    rejected: any;
    created: any;
    published: any;
  };
}

// Cache for loaded extractors to avoid reloading YAML files
const extractorCache = new Map<string, OpenApiSchemaExtractor>();

// Helper function to get or create an extractor for a version
const getExtractor = (version: string): OpenApiSchemaExtractor => {
  if (!extractorCache.has(version)) {
    // Use path relative to the source directory since YAML files are not copied to dist
    const yamlPath = path.resolve(__dirname, '..', '..', 'src', 'schemas', `openapi_v${version.replace('.', '_')}.yaml`);
    extractorCache.set(version, new OpenApiSchemaExtractor(yamlPath));
  }
  return extractorCache.get(version)!;
};


// Simple response schemas for general use (not version-specific)
const authTokenResponseSchema = {
  type: "object",
  properties: {
    access_token: { type: "string" },
  },
  required: ["access_token"],
};

const simpleResponseSchema = {
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

const emptyResponseSchema = {
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

const simpleSingleFootprintResponseSchema = {
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

// Get schemas for certain version
export function getSchema(version: string): VersionSchema {
  // Use a regex to obtain just  major.minor version ('v1.2.3' => '1.2')
  const match = version.match(/^v?(\d+\.\d+)/i)
  if (match) { 
    version = match[1];
  } else {
    throw new Error(`Invalid version format: ${version}`);
  }
  const extractor = getExtractor(version);
  const allSchemas = extractor.getAllSchemas();
  return {
    productFootprint: extractor.createJsonSchemaWithDefinitions('ProductFootprint'),
    authTokenResponseSchema,
    simpleResponseSchema,
    emptyResponseSchema,
    simpleSingleFootprintResponseSchema,
    listFootprintsResponse: {
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
    },
    singleFootprintResponse: {
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
    },
    events: {
      fulfilled: extractor.createJsonSchemaWithDefinitions('RequestFulfilledEvent'),
      rejected: extractor.createJsonSchemaWithDefinitions('RequestRejectedEvent'),
      created: extractor.createJsonSchemaWithDefinitions('RequestCreatedEvent'),
      published: extractor.createJsonSchemaWithDefinitions('PublishedEvent')
    }
  };
}
