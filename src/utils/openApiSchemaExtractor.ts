import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

interface OpenAPISpec {
  components?: {
    schemas?: { [key: string]: any };
  };
}

/**
 * Extracts JSON Schema objects from OpenAPI 3.1.0 specification
 * Converts OpenAPI schemas to AJV-compatible JSON schemas
 */
export class OpenApiSchemaExtractor {
  private spec: OpenAPISpec;
  private resolvedRefs: Map<string, any> = new Map();
  
  constructor(yamlFilePath: string) {
    const yamlContent = fs.readFileSync(yamlFilePath, 'utf8');
    this.spec = yaml.load(yamlContent) as OpenAPISpec;
  }

  /**
   * Extracts a specific schema by name from the OpenAPI components.schemas
   */
  getSchema(schemaName: string): any {
    const schema = this.spec.components?.schemas?.[schemaName];
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found in OpenAPI specification`);
    }
    return this.convertToJsonSchema(schema);
  }

  /**
   * Gets all available schema names
   */
  getAvailableSchemas(): string[] {
    return Object.keys(this.spec.components?.schemas || {});
  }

  /**
   * Get all schemas converted to JSON Schema format
   */
  getAllSchemas(): Record<string, any> {
    const schemas: Record<string, any> = {};
    
    if (this.spec?.components?.schemas) {
      for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
        schemas[name] = this.convertToJsonSchema(schema);
      }
    }

    return schemas;
  }

  /**
   * Create a complete JSON Schema with definitions for validation
   */
  createJsonSchemaWithDefinitions(rootSchemaName: string): any {
    const allSchemas = this.getAllSchemas();
    const rootSchema = allSchemas[rootSchemaName];

    if (!rootSchema) {
      throw new Error(`Root schema '${rootSchemaName}' not found`);
    }

    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      ...rootSchema,
      definitions: allSchemas
    };
  }

  /**
   * Converts OpenAPI schema to JSON Schema compatible with AJV
   */
  private convertToJsonSchema(schema: any, visited: Set<string> = new Set()): any {
    if (typeof schema !== 'object' || schema === null) {
      return schema;
    }

    // Handle $ref
    if (schema.$ref) {
      const refKey = schema.$ref;
      if (visited.has(refKey)) {
        // Avoid infinite recursion - return a reference placeholder
        return { $ref: this.convertRefToJsonSchemaFormat(refKey) };
      }
      visited.add(refKey);
      const resolved = this.resolveReference(refKey);
      visited.delete(refKey);
      return this.convertToJsonSchema(resolved, visited);
    }

    const converted = { ...schema };

    // Remove OpenAPI-specific keywords that AJV doesn't understand
    const openApiOnlyKeywords = [
      'summary', 
      'example', 
      'examples', 
      'externalDocs',
      'discriminator', 
      'xml', 
      'deprecated', 
      'writeOnly', 
      'readOnly',
      'note', // Custom documentation field
      'comment', // Another documentation field
      'Advisement' // PACT-specific documentation field
    ];
    
    openApiOnlyKeywords.forEach(keyword => {
      delete converted[keyword];
    });

    // Handle custom x-* extensions (remove all for AJV compatibility)
    Object.keys(converted).forEach(key => {
      if (key.startsWith('x-')) {
        delete converted[key];
      }
    });

    // Convert OpenAPI-specific formats to JSON Schema equivalents
    if (converted.format) {
      const newFormat = this.convertFormat(converted.format, converted);
      if (newFormat === undefined) {
        delete converted.format;
      } else {
        converted.format = newFormat;
      }
    }

    // Handle nullable (OpenAPI 3.0 style) - convert to oneOf with null
    if (converted.nullable === true) {
      delete converted.nullable;
      if (converted.type) {
        const originalSchema = { ...converted };
        delete originalSchema.nullable;
        return {
          oneOf: [
            originalSchema,
            { type: 'null' }
          ]
        };
      }
    }

    // Handle OpenAPI 3.1 style null types
    if (Array.isArray(converted.type) && converted.type.includes('null')) {
      // OpenAPI 3.1 supports array of types, but some AJV versions prefer oneOf
      if (converted.type.length === 2 && converted.type.includes('null')) {
        const nonNullType = converted.type.find((t: any) => t !== 'null');
        const originalSchema = { ...converted };
        originalSchema.type = nonNullType;
        return {
          oneOf: [
            originalSchema,
            { type: 'null' }
          ]
        };
      }
    }

    // Recursively process nested schemas
    if (converted.properties && typeof converted.properties === 'object') {
      const newProperties: any = {};
      Object.keys(converted.properties).forEach(propKey => {
        newProperties[propKey] = this.convertToJsonSchema(converted.properties[propKey], visited);
      });
      converted.properties = newProperties;
    }

    if (converted.items && typeof converted.items === 'object') {
      converted.items = this.convertToJsonSchema(converted.items, visited);
    }

    if (converted.additionalProperties && typeof converted.additionalProperties === 'object') {
      converted.additionalProperties = this.convertToJsonSchema(converted.additionalProperties, visited);
    }

    if (converted.allOf && Array.isArray(converted.allOf)) {
      converted.allOf = converted.allOf.map((item: any) => this.convertToJsonSchema(item, visited));
    }

    if (converted.oneOf && Array.isArray(converted.oneOf)) {
      converted.oneOf = converted.oneOf.map((item: any) => this.convertToJsonSchema(item, visited));
    }

    if (converted.anyOf && Array.isArray(converted.anyOf)) {
      converted.anyOf = converted.anyOf.map((item: any) => this.convertToJsonSchema(item, visited));
    }

    // Handle patternProperties if present
    if (converted.patternProperties && typeof converted.patternProperties === 'object') {
      const newPatternProperties: any = {};
      Object.keys(converted.patternProperties).forEach(pattern => {
        newPatternProperties[pattern] = this.convertToJsonSchema(converted.patternProperties[pattern], visited);
      });
      converted.patternProperties = newPatternProperties;
    }

    return converted;
  }

  /**
   * Converts OpenAPI formats to JSON Schema compatible formats
   */
  private convertFormat(format: string, schema: any): string | undefined {
    const formatMap: { [key: string]: string | undefined } = {
      // Keep standard JSON Schema formats
      'date-time': 'date-time',
      'date': 'date',
      'time': 'time',
      'email': 'email',
      'hostname': 'hostname',
      'ipv4': 'ipv4',
      'ipv6': 'ipv6',
      'uri': 'uri',
      'uri-reference': 'uri-reference',
      'uri-template': 'uri-template',
      'json-pointer': 'json-pointer',
      'relative-json-pointer': 'relative-json-pointer',
      'regex': 'regex',
      'uuid': 'uuid',
      
      // Convert OpenAPI specific formats
      'int32': undefined, // Remove format, keep type as integer
      'int64': undefined, // Remove format, keep type as integer  
      'float': undefined, // Remove format, keep type as number
      'double': undefined, // Remove format, keep type as number
      'byte': undefined, // Remove format for base64 encoded strings
      'binary': undefined, // Remove format for binary strings
      'password': undefined, // Remove format, treat as regular string
      
      // Handle custom formats
      'decimal': undefined, // Remove unsupported format
      'urn': undefined // Will be handled with pattern instead
    };

    // Special handling for URN format - use pattern from OpenAPI spec
    if (format === 'urn') {
      // Use the same pattern as defined in OpenAPI YAML: case-insensitive "urn:" prefix
      schema.pattern = '^([uU][rR][nN]):';
      return undefined;
    }

    return formatMap.hasOwnProperty(format) ? formatMap[format] : format;
  }

  /**
   * Convert OpenAPI reference format to JSON Schema format
   */
  private convertRefToJsonSchemaFormat(ref: string): string {
    if (ref.startsWith('#/components/schemas/')) {
      const schemaName = ref.replace('#/components/schemas/', '');
      return `#/definitions/${schemaName}`;
    }
    return ref;
  }

  /**
   * Resolves $ref references within the OpenAPI document
   */
  private resolveReference(ref: string): any {
    if (!ref.startsWith('#/')) {
      throw new Error(`External references not supported: ${ref}`);
    }
    
    const path = ref.substring(2).split('/');
    let current = this.spec as any;
    
    for (const segment of path) {
      current = current[segment];
      if (current === undefined) {
        throw new Error(`Reference not found: ${ref}`);
      }
    }
    
    return current;
  }
}
