import path from 'path';
import { OpenApiSchemaExtractor } from './open-api-schema-extractor';

// Define the schema structure for each version
export interface VersionSchema {
  productFootprint: any;
  listFootprintResponse: any;
  getFootprintResponse: any;
  authTokenResponse: any;
  simpleListFootprintResponse: any;
  simpleGetFootprintResponse: any;
  emptyResponse: any;
  events?: {
    fulfilled: any;
    rejected: any;
    created: any;
    published: any;
  };
}

// Cache for loaded extractors to avoid reloading YAML files
const extractorCache = new Map<string, OpenApiSchemaExtractor>();

// Helper function to get or create an extractor for a version. Resolves the YAML
// next to the compiled JS (or TS source), and falls back to the source-tree copy
// when running from `dist/` because tsc doesn't copy non-TS assets.
const getExtractor = async (version: string): Promise<OpenApiSchemaExtractor> => {
  if (!extractorCache.has(version)) {
    const file = `openapi_v${version.replace('.', '_')}.yaml`;
    // In the standalone Bun binary the YAML is embedded in the executable and its
    // path is registered on globalThis (see schemas/embedded-schemas.ts) — __dirname
    // there points at the build-time path which doesn't exist at runtime, so use the
    // embedded copy when available and fall back to the filesystem otherwise.
    const embedded = (globalThis as any).__PACT_EMBEDDED_SCHEMA_PATHS as
      | Record<string, string>
      | undefined;
    let yamlPath = embedded?.[version];
    if (!yamlPath) {
      const localPath = path.resolve(__dirname, file);
      const sourcePath = path.resolve(__dirname, '..', '..', 'src', 'schemas', file);
      yamlPath = localPath;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('fs').accessSync(localPath);
      } catch {
        yamlPath = sourcePath;
      }
    }
    extractorCache.set(version, await OpenApiSchemaExtractor.create(yamlPath));
  }
  return extractorCache.get(version)!;
};

// Get schemas for certain version
export async function getSchema(version: string): Promise<VersionSchema> {
  // Use a regex to obtain just  major.minor version ('v1.2.3' => '1.2')
  const match = version.match(/^v?(\d+\.\d+)/i)
  if (match) { 
    version = match[1];
  } else {
    throw new Error(`Invalid version format: ${version}`);
  }
  const extractor = await getExtractor(version);
  const allSchemas = extractor.getAllSchemas();
  return {
    productFootprint: extractor.createJsonSchemaWithDefinitions('ProductFootprint'),
    authTokenResponse: {
      type: "object",
      properties: {
        access_token: { type: "string" },
      },
      required: ["access_token"],
    },
    simpleListFootprintResponse: {
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
    },
    emptyResponse: {
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
    },
    simpleGetFootprintResponse: {
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
    },
    listFootprintResponse: {
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
    getFootprintResponse: {
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
