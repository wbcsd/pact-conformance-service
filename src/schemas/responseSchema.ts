// Import the new schema registry
import { 
  schemas, 
  getSchemaForVersion, 
  getProductFootprintSchema,
  getListFootprintsResponseSchema,
  getSingleFootprintResponseSchema,
  getEventSchema,
  SUPPORTED_VERSIONS,
  type VersionSchema
} from "./schemaRegistry";

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

// Export the new schema registry system
export { 
  schemas, 
  // getSchemaForVersion, 
  // getProductFootprintSchema,
  // getListFootprintsResponseSchema,
  // getSingleFootprintResponseSchema,
  // getEventSchema,
  // SUPPORTED_VERSIONS,
  // type VersionSchema
};

// Legacy exports for backward compatibility
// export const v2_0_ResponseSchema = schemas['2.0'].listFootprintsResponse;
// export const v2_0_productFootprintSchema = schemas['2.0'].productFootprint;
// export const v2_0_SingleFootprintResponseSchema = schemas['2.0'].singleFootprintResponse;

// export const v2_1_ResponseSchema = schemas['2.1'].listFootprintsResponse;
// export const v2_1_productFootprintSchema = schemas['2.1'].productFootprint;
// export const v2_1_SingleFootprintResponseSchema = schemas['2.1'].singleFootprintResponse;

// export const v2_2_ResponseSchema = schemas['2.2'].listFootprintsResponse;
// export const v2_2_productFootprintSchema = schemas['2.2'].productFootprint;
// export const v2_2_SingleFootprintResponseSchema = schemas['2.2'].singleFootprintResponse;

// export const v2_3_ResponseSchema = schemas['2.3'].listFootprintsResponse;
// export const v2_3_productFootprintSchema = schemas['2.3'].productFootprint;
// export const v2_3_SingleFootprintResponseSchema = schemas['2.3'].singleFootprintResponse;

// export const v3_0_ResponseSchema = schemas['3.0'].listFootprintsResponse;
// export const v3_0_productFootprintSchema = schemas['3.0'].productFootprint;
// export const V3_0_SingleFootprintResponseSchema = schemas['3.0'].singleFootprintResponse;
// export const v3_0_EventFulfilledSchema = schemas['3.0'].events?.fulfilled;

// Additional legacy exports
// export { eventFulfilledSchema };
