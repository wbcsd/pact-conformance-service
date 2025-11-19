// Product Footprint and Response Schema for v2.0
export const productFootprintSchema = {
  type: "object",
  title: "ProductFootprint",
  required: [
    "id",
    "specVersion",
    "version",
    "created",
    "status",
    "comment",
    "companyName",
    "companyIds",
    "productDescription",
    "productIds",
    "productCategoryCpc",
    "productNameCompany",
    "pcf",
  ],
  properties: {
    id: {
      type: "string",
      format: "uuid",
      description: "A unique identifier for the entire PCF dataset.",
    },
    specVersion: {
      type: "string",
      pattern: "^\\d+\\.\\d+\\.\\d+(-\\d{8})?$",
      description: "The version of the PACT Tech Specs the data complies with.",
    },
    precedingPfIds: {
      type: "array",
      items: {
        type: "string",
        format: "uuid",
      },
      minItems: 1,
      uniqueItems: true,
      description: "Identifiers of previous versions of this PCF.",
    },
    version: {
      type: "integer",
      minimum: 0,
      description: "The version number of the PCF.",
    },
    created: {
      type: "string",
      format: "date-time",
      description: "Timestamp when the PCF was created.",
    },
    updated: {
      type: "string",
      format: "date-time",
      description: "Timestamp when the PCF was last updated.",
    },
    status: {
      type: "string",
      enum: ["Active", "Deprecated"],
      description: "Current status of the PCF.",
    },
    statusComment: {
      type: "string",
      description: "Explanation for the current status.",
    },
    validityPeriodStart: {
      type: "string",
      format: "date-time",
      description: "Start of the PCF validity period.",
    },
    validityPeriodEnd: {
      type: "string",
      format: "date-time",
      description: "End of the PCF validity period.",
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
      description: "List of company identifiers (URNs).",
    },
    productDescription: {
      type: "string",
      description: "A free-form description of the product.",
    },
    productIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: {
        $ref: "#/definitions/Urn",
      },
      description: "List of product identifiers (URNs).",
    },
    productCategoryCpc: {
      $ref: "#/definitions/NonEmptyString",
    },
    productNameCompany: {
      $ref: "#/definitions/NonEmptyString",
    },
    comment: {
      type: "string",
      description: "Additional information related to the PCF.",
    },
    pcf: {
      $ref: "#/definitions/CarbonFootprint",
    },
  },
};

const sharedDefinitions = {
  ProductFootprint: productFootprintSchema,
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
      "declaredUnit",
      "unitaryProductAmount",
      "referencePeriodStart",
      "referencePeriodEnd",
      "pCfExcludingBiogenic",
      "fossilGhgEmissions",
      "fossilCarbonContent",
      "biogenicCarbonContent",
      "characterizationFactors",
      "crossSectoralStandardsUsed",
      "boundaryProcessesDescription",
      "exemptedEmissionsPercent",
      "exemptedEmissionsDescription",
      "packagingEmissionsIncluded",
    ],
    properties: {
      declaredUnit: {
        type: "string",
        enum: [
          "liter",
          "kilogram",
          "cubic meter",
          "kilowatt hour",
          "megajoule",
          "ton kilometer",
          "square meter",
        ],
        description: "The unit in which the PCF was calculated.",
      },
      unitaryProductAmount: {
        type: "string",
        pattern: "^[+]?((\\d*[1-9]\\d*)(\\.\\d+)?|(0+\\.\\d*[1-9]\\d*))$",
        description:
          "The amount of declared unit contained in the product (must be > 0).",
      },
      pCfExcludingBiogenic: {
        type: "string",
        pattern: "^[+]?\\d+(\\.\\d+)?$",
        description: "The PCF of the product excluding biogenic CO2 emissions.",
      },
      pCfIncludingBiogenic: {
        type: "string",
        pattern: "^[+-]?\\d+(\\.\\d+)?$",
        description: "The PCF of the product including all biogenic emissions.",
      },
      fossilGhgEmissions: {
        type: "string",
        pattern: "^[+]?\\d+(\\.\\d+)?$",
        description: "GHG emissions from fossil fuel sources.",
      },
      fossilCarbonContent: {
        type: "string",
        pattern: "^[+]?\\d+(\\.\\d+)?$",
        description: "Fossil carbon content.",
      },
      biogenicCarbonContent: {
        type: "string",
        pattern: "^[+]?\\d+(\\.\\d+)?$",
        description: "Biogenic carbon content.",
      },
      dLucGhgEmissions: {
        type: "string",
        pattern: "^[+]?\\d+(\\.\\d+)?$",
        description: "Emissions from direct land use change.",
      },
      landManagementGhgEmissions: {
        type: "string",
        pattern: "^[+]?\\d+(\\.\\d+)?$",
        description: "GHG emissions from land management.",
      },
      otherBiogenicGhgEmissions: {
        type: "string",
        pattern: "^[+]?\\d+(\\.\\d+)?$",
        description: "Other biogenic GHG emissions not included elsewhere.",
      },
      iLucGhgEmissions: {
        type: "string",
        pattern: "^[+]?\\d+(\\.\\d+)?$",
        description: "Emissions from indirect land use change.",
      },
      biogenicCarbonWithdrawal: {
        type: "string",
        pattern: "^-?\\d+(\\.\\d+)?$",
        description: "Biogenic carbon withdrawal value (may be ≤ 0).",
      },
      aircraftGhgEmissions: {
        type: "string",
        pattern: "^[+]?\\d+(\\.\\d+)?$",
        description: "Emissions from aircraft engine usage.",
      },
      characterizationFactors: {
        type: "string",
        enum: ["AR6", "AR5"],
        description: "IPCC GWP characterization factors.",
      },
      crossSectoralStandardsUsed: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "GHG Protocol Product standard",
            "ISO Standard 14067",
            "ISO Standard 14044",
          ],
        },
        minItems: 1,
        uniqueItems: true,
        description: "Cross-sectoral standards used.",
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
                "Operator of PCR being used for the PCF calculation.",
            },
            ruleNames: {
              type: "array",
              items: {
                type: "string",
                minLength: 1,
              },
              minItems: 1,
              uniqueItems: true,
              description: "Names of the product or sector specific rules.",
            },
            otherOperatorName: {
              type: "string",
              minLength: 1,
              description: "Name of the operator if 'Other' is selected.",
            },
          },
        },
        uniqueItems: true,
        description: "Product or sector specific rules applied.",
      },
      biogenicAccountingMethodology: {
        type: "string",
        enum: ["PEF", "ISO", "GHGP", "Quantis"],
        description:
          "Standard followed to account for biogenic emissions and removals.",
      },
      boundaryProcessesDescription: {
        type: "string",
        description:
          "Description of the processes included in the PCF boundary.",
      },
      referencePeriodStart: {
        type: "string",
        format: "date-time",
        description: "Start (inclusive) of the reporting period.",
      },
      referencePeriodEnd: {
        type: "string",
        format: "date-time",
        description: "End (exclusive) of the reporting period.",
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
        description: "Geographic region or subregion of the PCF.",
      },
      geographyCountry: {
        type: "string",
        pattern: "^[A-Z]{2}$",
        description: "ISO 3166-1 alpha-2 country code.",
      },
      geographyCountrySubdivision: {
        type: "string",
        pattern: "^[A-Z]{2}-[A-Z0-9]{1,3}$",
        description: "ISO 3166-2 country subdivision code.",
      },
      secondaryEmissionFactorSources: {
        type: "array",
        minItems: 1,
        items: {
          $ref: "#/definitions/EmissionFactorDatabases",
        },
        description: "Secondary data sources for emission factors.",
      },
      exemptedEmissionsPercent: {
        type: "number",
        minimum: 0,
        maximum: 5,
        description: "Percentage of emissions excluded from the PCF.",
      },
      exemptedEmissionsDescription: {
        type: "string",
        description: "Rationale for excluding certain emissions.",
      },
      packagingEmissionsIncluded: {
        type: "boolean",
        description:
          "Flag indicating whether packaging emissions are included.",
      },
      packagingGhgEmissions: {
        type: "string",
        pattern: "^[+]?\\d+(\\.\\d+)?$",
        description: "Emissions from packaging (if included).",
      },
      allocationRulesDescription: {
        type: "string",
        description: "Description of any allocation rules applied.",
      },
      uncertaintyAssessmentDescription: {
        type: "string",
        description: "Summary of the uncertainty assessment.",
      },
      primaryDataShare: {
        type: "number",
        description: "Share of primary data used (in percent).",
      },
      dqi: {
        type: "object",
        description:
          "Data Quality Indicators in accordance with the PACT Methodology.",
        required: [
          "coveragePercent",
          "technologicalDQR",
          "temporalDQR",
          "geographicalDQR",
          "completenessDQR",
          "reliabilityDQR",
        ],
        properties: {
          coveragePercent: {
            $ref: "#/definitions/Percent",
          },
          technologicalDQR: {
            $ref: "#/definitions/FloatBetween1And3",
          },
          temporalDQR: {
            $ref: "#/definitions/FloatBetween1And3",
          },
          geographicalDQR: {
            $ref: "#/definitions/FloatBetween1And3",
          },
          completenessDQR: {
            $ref: "#/definitions/FloatBetween1And3",
          },
          reliabilityDQR: {
            $ref: "#/definitions/FloatBetween1And3",
          },
        },
      },
      assurance: {
        type: "object",
        description: "Assurance information for the PCF.",
        required: ["assurance", "providerName"],
        properties: {
          assurance: {
            type: "boolean",
            description: "Indicates if the PCF has been assured.",
          },
          coverage: {
            type: "string",
            enum: [
              "corporate level",
              "product line",
              "PCF system",
              "product level",
            ],
            description: "Granularity level of the assured emissions data.",
          },
          level: {
            type: "string",
            enum: ["limited", "reasonable"],
            description: "Level of assurance.",
          },
          boundary: {
            type: "string",
            enum: ["Gate-to-Gate", "Cradle-to-Gate"],
            description: "The assurance boundary.",
          },
          providerName: {
            type: "string",
            description: "Name of the assurance provider.",
          },
          completedAt: {
            type: "string",
            format: "date-time",
            description: "Timestamp when assurance was completed.",
          },
          standardName: {
            type: "string",
            description: "Name of the assurance standard used.",
          },
          comments: {
            type: "string",
            description: "Additional assurance comments.",
          },
        },
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
  },
  EmissionFactorDatabases: {
    type: "object",
    title: "EmissionFactorDatabases",
    required: ["name", "version"],
    properties: {
      name: {
        $ref: "#/definitions/NonEmptyString",
      },
      version: {
        $ref: "#/definitions/NonEmptyString",
      },
    },
  },
  Percent: {
    type: "number",
    minimum: 0,
    maximum: 100,
    description: "A percentage value.",
  },
  FloatBetween1And3: {
    type: "number",
    minimum: 1,
    maximum: 3,
    description: "A float value between 1 and 3.",
  },
};

export const ResponseSchema = {
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

export const SingleFootprintResponseSchema = {
  type: "object",
  properties: {
    data: {
      $ref: "#/definitions/ProductFootprint",
    },
  },
  required: ["data"],
  definitions: sharedDefinitions,
};
