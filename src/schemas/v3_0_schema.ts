// Product Footprint and Response Schema for v3.0
export const v3_0_productFootprintSchema = {
  type: "object",
  title: "ProductFootprint",
  required: [
    "id",
    "specVersion",
    "created",
    "status",
    "companyName",
    "companyIds",
    "productDescription",
    "productIds",
    "productNameCompany",
    "pcf",
  ],
  properties: {
    id: {
      type: "string",
      format: "uuid",
      description:
        "A unique identifier that a system uses to refer to the entire dataset of the PCF.",
    },
    specVersion: {
      type: "string",
      pattern: "^\\d+\\.\\d+\\.\\d+(-\\d{8})?$",
      description:
        "The version of the PACT Technical Specifications that the data being shared complies with.",
    },
    precedingPfIds: {
      type: "array",
      items: {
        type: "string",
        format: "uuid",
      },
      minItems: 1,
      uniqueItems: true,
      description:
        'A list of IDs that reflect "past versions" of the current PCF.',
    },
    created: {
      type: "string",
      format: "date-time",
      description: "The date and time when the PCF was created.",
    },
    status: {
      type: "string",
      enum: ["Active", "Deprecated"],
      description:
        "The status of the PCF. Active means that the PCF is the most recent version.",
    },
    validityPeriodStart: {
      type: "string",
      format: "date-time",
      description: "The start date of the validity period.",
    },
    validityPeriodEnd: {
      type: "string",
      format: "date-time",
      description: "The end date and time of the validity period.",
    },
    companyName: {
      $ref: "#/definitions/NonEmptyString",
    },
    companyIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: {
        $ref: "#/definitions/Urn",
      },
      description: "The non-empty set of Uniform Resource Names (URN).",
    },
    productDescription: {
      type: "string",
      description: "The free-form description of the product.",
    },
    productIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: {
        $ref: "#/definitions/Urn",
      },
      description: "The non-empty set of Product IDs in URN format.",
    },
    productClassifications: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: {
        $ref: "#/definitions/Urn",
      },
      description:
        "The non-empty set of Product Classifications in URN format.",
    },
    productNameCompany: {
      $ref: "#/definitions/NonEmptyString",
    },
    comment: {
      type: "string",
      description: "Any additional information related to the PCF.",
    },
    pcf: {
      $ref: "#/definitions/CarbonFootprint",
    },
    extensions: {
      type: "array",
      items: {
        $ref: "#/definitions/DataModelExtension",
      },
      description:
        "If defined, 1 or more data model extensions associated with the ProductFootprint.",
    },
  },
};

const sharedDefinitions = {
  ProductFootprint: v3_0_productFootprintSchema,
  NonEmptyString: {
    type: "string",
    minLength: 1,
    description: "A non-empty string.",
  },
  Urn: {
    type: "string",
    pattern: "^([uU][rR][nN]):",
    description: "A Uniform Resource Name (URN).",
  },
  CarbonFootprint: {
    type: "object",
    title: "CarbonFootprint",
    required: [
      "declaredUnitOfMeasurement",
      "declaredUnitAmount",
      "productMassPerDeclaredUnit",
      "referencePeriodStart",
      "referencePeriodEnd",
      "pcfExcludingBiogenicUptake",
      "pcfIncludingBiogenicUptake",
      "fossilGhgEmissions",
      "fossilCarbonContent",
      "ipccCharacterizationFactors",
      "crossSectoralStandards",
      "exemptedEmissionsPercent",
    ],
    properties: {
      declaredUnitOfMeasurement: {
        type: "string",
        enum: [
          "liter",
          "kilogram",
          "cubic meter",
          "kilowatt hour",
          "megajoule",
          "ton kilometer",
          "square meter",
          "piece",
          "hour",
          "megabit second",
        ],
        description: "The unit in which the PCF was calculated.",
      },
      declaredUnitAmount: {
        type: "string",
        pattern: "^[+]?((\\d*[1-9]\\d*)(\\.\\d+)?|(0+\\.\\d*[1-9]\\d*))$",
        description:
          "The amount of declared unit contained in the product (must be > 0).",
      },
      productMassPerDeclaredUnit: {
        type: "string",
        pattern: "^[+-]?\\d+(\\.\\d+)?$",
        description: "Mass (in kg) of the product per declared unit.",
      },
      referencePeriodStart: {
        type: "string",
        format: "date-time",
        description:
          "Start of the reference period for which the data is valid.",
      },
      referencePeriodEnd: {
        type: "string",
        format: "date-time",
        description: "End of the reference period for which the data is valid.",
      },
      geographyRegionOrSubregion: {
        type: "string",
        enum: [
          "Africa",
          "Americas",
          "Asia",
          "Europe",
          "Oceania",
          "Australia and New Zealand",
          "Central Asia",
          "Eastern Asia",
          "Eastern Europe",
          "Latin America and the Caribbean",
          "Melanesia",
          "Micronesia",
          "Northern Africa",
          "Northern America",
          "Northern Europe",
          "Polynesia",
          "South-eastern Asia",
          "Southern Asia",
          "Southern Europe",
          "Sub-Saharan Africa",
          "Western Asia",
          "Western Europe",
        ],
        description:
          "Geographic region or subregion where the product was produced.",
      },
      geographyCountry: {
        type: "string",
        pattern: "^[A-Z]{2}$",
        description:
          "Country where the product was produced using ISO 3166-1 alpha-2 code.",
      },
      geographyCountrySubdivision: {
        type: "string",
        pattern: "^[A-Z]{2}-[A-Z0-9]{1,3}$",
        description:
          "Country subdivision where the product was produced using ISO 3166-2 code.",
      },
      pcfExcludingBiogenicUptake: {
        type: "string",
        pattern: "^[+-]?\\d+(\\.\\d+)?$",
        description:
          "Product carbon footprint excluding biogenic carbon uptake.",
      },
      pcfIncludingBiogenicUptake: {
        type: "string",
        pattern: "^[+-]?\\d+(\\.\\d+)?$",
        description:
          "Product carbon footprint including biogenic carbon uptake.",
      },
      fossilGhgEmissions: {
        type: "string",
        pattern: "^[+-]?\\d+(\\.\\d+)?$",
        description: "Fossil GHG emissions.",
      },
      fossilCarbonContent: {
        type: "string",
        pattern: "^[+-]?\\d+(\\.\\d+)?$",
        description: "Fossil carbon content.",
      },
      ipccCharacterizationFactors: {
        type: "array",
        items: {
          type: "string",
          pattern: "^AR\\d+$",
        },
        minItems: 1,
        uniqueItems: true,
        description:
          "IPCC characterization factors used in the calculation of the PCF.",
      },
      crossSectoralStandards: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "ISO14067",
            "ISO14083",
            "ISO14040-44",
            "GHGP-Product",
            "PEF",
            "PACT-1.0",
            "PACT-2.0",
            "PACT-3.0",
          ],
        },
        minItems: 1,
        uniqueItems: true,
        description: "Cross-sectoral standards used in the calculation.",
      },
      exemptedEmissionsPercent: {
        type: "string",
        pattern: "^[+-]?\\d+(\\.\\d+)?$",
        description: "Percentage of emissions exempted.",
      },
      productOrSectorSpecificRules: {
        type: "array",
        items: {
          type: "object",
          required: ["operator", "ruleNames"],
          properties: {
            operator: {
              type: "string",
              enum: ["PEF", "EPD International", "Other"],
              description:
                "Selection of operator of PCR being used for the PCF calculation. If operator is not available in the given list, or if a sector specific guidance has been followed, please set 'Other' and include details under 'otherOperatorName'.",
            },
            ruleNames: {
              type: "array",
              items: {
                type: "string",
                minLength: 1,
              },
              minItems: 1,
              uniqueItems: true,
              description:
                "Names of the product or sector specific rules being used for the PCF calculation.",
            },
            otherOperatorName: {
              type: "string",
              minLength: 1,
              description:
                "If operator is Other, then this attribute must be populated with the name of the operator.",
            },
          },
        },
        minItems: 1,
        uniqueItems: true,
        description:
          "The product-specific or sector-specific rules applied for calculating or allocating GHG emissions.",
      },
      ccuCalculationApproach: {
        type: "string",
        enum: ["Cut-off", "Credit"],
        description:
          "The approach used for calculating technological CO2 capture, storage, and use (CCU) emissions.",
      },
      ccuCreditCertification: {
        type: "string",
        format: "uri",
        description:
          "(Only for Credit Approach) a URL to documentation verifying the certification from an external bookkeeping scheme.",
      },
    },
    oneOf: [
      {
        oneOf: [
          { required: ["geographyRegionOrSubregion"] },
          { required: ["geographyCountry"] },
          { required: ["geographyCountrySubdivision"] },
        ],
      },
      {
        not: {
          anyOf: [
            { required: ["geographyRegionOrSubregion"] },
            { required: ["geographyCountry"] },
            { required: ["geographyCountrySubdivision"] },
          ],
        },
      },
    ],
    errorMessage: {
      oneOf:
        "Only one of geographyRegionOrSubregion, geographyCountry, or geographyCountrySubdivision should be present.",
    },
  },
  DataModelExtension: {
    type: "object",
    title: "DataModelExtension",
    required: ["specVersion", "data"],
    properties: {
      specVersion: {
        type: "string",
        description: "Version of the extension specification.",
      },
      data: {
        type: "object",
        description: "Extension data.",
      },
    },
  },
  Verification: {
    type: "object",
    title: "Verification",
    properties: {
      coverage: {
        type: "string",
        enum: ["PCF calculation model", "PCF program", "product level"],
        description:
          "The coverage of the verification defines the type and level of GHG data to be verified.",
      },
      providerName: {
        type: "string",
        description:
          "The non-empty name of the independent third party engaged to undertake the verification.",
      },
      completedAt: {
        type: "string",
        format: "date-time",
        description: "The date at which the verification was completed.",
      },
      standardName: {
        type: "string",
        description: "Name of the standard against which the PCF was assured.",
      },
      comments: {
        type: "string",
        description:
          "Any additional comments that will clarify the interpretation of the verification.",
      },
    },
  },
  DataQualityIndicators: {
    type: "object",
    title: "DataQualityIndicators",
    required: ["technologicalDQR", "geographicalDQR", "temporalDQR"],
    properties: {
      technologicalDQR: {
        type: "string",
        pattern: "^[+-]?\\d+(\\.\\d+)?$",
        description:
          "Technological Data Quality Rating between 1 and 5 inclusive.",
      },
      geographicalDQR: {
        type: "string",
        pattern: "^[+-]?\\d+(\\.\\d+)?$",
        description:
          "Geographical Data Quality Rating between 1 and 5 inclusive.",
      },
      temporalDQR: {
        type: "string",
        pattern: "^[+-]?\\d+(\\.\\d+)?$",
        description: "Temporal Data Quality Rating between 1 and 5 inclusive.",
      },
    },
  },
};

export const v3_0_ResponseSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ListFootprintsResponse",
  type: "object",
  required: ["data"],
  properties: {
    data: {
      type: "array",
      items: {
        $ref: "#/definitions/ProductFootprint",
      },
    },
  },
  definitions: sharedDefinitions,
};

export const v3_0_EventFulfilledSchema = {
  type: "object",
  required: ["type", "specversion", "id", "source", "time", "data"],
  properties: {
    type: {
      type: "string",
      const: "org.wbcsd.pact.ProductFootprint.RequestFulfilledEvent.3",
      description:
        "Event type identifier for a fulfilled product footprint request",
    },
    specversion: {
      type: "string",
      description: "Version of the CloudEvents specification",
    },
    id: {
      type: "string",
      format: "uuid",
      description: "Unique identifier for the event",
    },
    source: {
      type: "string",
      description: "URI identifying the context in which the event happened",
    },
    time: {
      type: "string",
      format: "date-time",
      description: "Timestamp when the event was generated",
    },
    data: {
      type: "object",
      required: ["requestEventId", "pfs"],
      properties: {
        requestEventId: {
          type: "string",
          description: "ID of the original request event",
        },
        pfs: {
          type: "array",
          minItems: 1,
          items: {
            $ref: "#/definitions/ProductFootprint",
          },
          description: "Array of product footprints",
        },
      },
    },
  },
  definitions: sharedDefinitions,
};

export const V3_0_SingleFootprintResponseSchema = {
  type: "object",
  properties: {
    data: {
      $ref: "#/definitions/ProductFootprint",
    },
  },
  required: ["data"],
  definitions: sharedDefinitions,
};
