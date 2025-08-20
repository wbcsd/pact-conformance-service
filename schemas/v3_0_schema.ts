export interface paths {
    "/3/footprints": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Action ListFootprints
         * @description Retrieve a list of Product Carbon Footprints (PCFs) from the [=data owner=].
         *     The [=data recipient=] can specify various criteria to filter the
         *     list, and the [=data owner=] can paginate the result set, if necessary.
         *
         *     Host systems SHOULD implement an access management system and only
         *     return the product footprints for which the data owner granted access
         *     to the requesting data recipient.
         *
         *     The host system SHOULD include footprints which have been deprecated in the
         *     resulting list of footprints, except if the `status` query parameter
         *     explicity requests only active footprints.
         *
         *     ### Pagination
         *
         *      1. The host system MUST NOT return more product footprints than requested in
         *         case a `limit` parameter was specified by a [=data recipient=]
         *      2. The host system MUST return an HTTP `Link` header if there are additional
         *         ProductFootprints ready to be retrieved, such that
         *           - The `Link` header conforms to [[!RFC8288]]
         *           - The value of the `rel` parameter is equal to `next`
         *           - the target URI of the `Link` header is absolute
         *           - The value of `host` of the target URI is equal to the value of the `host`
         *             request header from the original `ListFootprints` HTTP request
         *      3. The target URI from the `Link` header is called a pagination link.
         *      4. A pagination link MUST be valid for at least 180 seconds after creation
         *      5. The data recipient CAN call the pagination link more than once
         *      6. Upon each call, the host system
         *           - MUST NOT return more product footprints than requested in case
         *             `limit` was defined by a [=data recipient=]
         *           - MUST return a `Link` header conforming with the previous description in case
         *             there are additional ProductFootprints available
         *             ```http
         *             link: <https://api.example.com/3/footprints?geography=FR&limit=10&offset=10>; rel="next"
         *             ```
         *      7. If a response contains a second pagination link and the data recipient has called
         *         that second pagination link, the previous pagination link MAY no longer work: data
         *         recipients MUST NOT assume that previous pagination links continue to return results
         *         after advancing in the pagination process.
         *
         *     ### Filtering
         *
         *     The [=host system=] MUST support filtering of the list of footprints by
         *     criteria described under Parameters. Note that these are the same filters
         *     used by the [[#request-created-event]] Event.
         *
         *     Most criteria (like `productId`, `geography`, etc.) can contain multiple
         *     values. Each footprint in the resulting list MUST match for EACH single
         *     criterion at least ONE value.
         *
         *     So, the filtering logic is as follows:
         *     - For each filter criterion (e.g., `productId`, `geography`, `classification`), if multiple values are provided, the filter matches if the footprint matches at least one of the values for that criterion (logical OR within a criterion).
         *     - Across different criteria, a footprint must match all specified criteria (logical AND between criteria).
         *
         *     In other words:
         *     - Within a single criterion: values are combined with OR.
         *     - Between different criteria: criteria are combined with AND.
         *
         *     For example, the query string for `ListFootprints`
         *
         *     ```http
         *     ?productId=x&productid=y&productid=z&geography=DE&geography=FR&validon=2025-04-01T00:00Z
         *     ```
         *
         *     translates to the following logic:
         *
         *     ```
         *     (productId='x' OR productId='y' OR productId='z') AND
         *     (geography='DE' OR geography='FR') AND
         *     (validOn='2025-04-01T00:00Z')
         *     ```
         *
         *     Additionally, a host system MAY provide additional filter criteria for the data
         *     recipient to use. These parameters MUST be prefixed with `x-<identifier>-`.
         *
         *     For example, to add functionality to search for product
         *     footprints based on an invoice number, a software solution could choose
         *     to support a parameter `x-atq-invoice-id`.
         *
         *     ```http
         *     /3/footprints/?geography=FR&x-atq-invoice-id=12345&limit=100
         *     ```
         *
         *     Advisement: the ODataV4 `$filter` syntax present in v2.x has been deprecated in v3.0.
         *
         */
        get: {
            parameters: {
                query?: {
                    /** @description The maximum number of footprints to return. The [=host system=] MAY return fewer
                     *     footprints, but MUST return a Link header conforming to [[!RFC8288]] if there are
                     *     additional ProductFootprints ready to be retrieved.
                     *      */
                    limit?: number;
                    /** @description One or more product IDs. Will return all footprints which have a corresponding ID in their `productIds` attribute. The match must be-case insensitive. Note that a footprint itself can also have multiple product IDs. */
                    productId?: components["parameters"]["productId"];
                    /** @description One or more company IDs. Will return all footprints which have a corresponding ID in their `companyId` attribute. The match must be case-insensitive. Note that a footprint itself can also have multiple company IDs. */
                    companyId?: components["parameters"]["companyId"];
                    /** @description One or more geographic specifiers. Values specified can denote `geographyRegion` or `geographyCountry` or `geographyCountrySubdivision`. Will return all footprints within the specified geography(s). The match must be-case insensitive. */
                    geography?: components["parameters"]["geography"];
                    /** @description One or more product classifications. Will return all footprints with corresponding values in the `productClassifications` attribute. Note that a footprint itself can have multiple classifications. The match must be-case insensitive. */
                    classification?: components["parameters"]["classification"];
                    /** @description If present, MUST match all PCFs which were valid on the date specified: start validity period <= validOn <= end validity period. See [[#validity-period]] for determining validity period.
                     *      */
                    validOn?: components["parameters"]["validOn"];
                    /** @description If present, MUST match PCFs with a validity period start > validAfter.
                     *     See [[#validity-period]] for determining validity period.
                     *      */
                    validAfter?: components["parameters"]["validAfter"];
                    /** @description If present, MUST match PCFs with a validity period end < validBefore
                     *     See [[#validity-period]] for determining validity period.
                     *      */
                    validBefore?: components["parameters"]["validBefore"];
                    /** @description If present, MUST be "Active" or "Deprecated". If not specified, will return footprints regardless of status. The match must be-case insensitive.
                     *      */
                    status?: components["parameters"]["status"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The host system succesfully returns a list of product footprints. This list
                 *     MAY be incomplete, in which case the host system MUST return a Link header
                 *     conforming to [[!RFC8288]], also see [[#pagination]]. The list MUST NOT be
                 *     larger than the `limit`, if specified.
                 *
                 *     ```http
                 *     HTTP/1.1 200 OK
                 *     link: <https://api.example.com/3/footprints?geography=FR&limit=10&offset=10>; rel="next"
                 *     content-type: application/json
                 *     ```
                 *     ```json
                 *     {
                 *       "data": [
                 *         {"id": "079e425a-464f-528d-341d-4a944a1dfd70", ... },
                 *         {"id": "f4b1225a-bd44-4c8e-861d-079e4e1dfd69", ... }
                 *         ...
                 *       ]
                 *     }
                 *     ```
                 *
                 *     The list MAY also be empty. If the list is empty, the host system MUST return an empty
                 *     JSON array. The list MUST NOT be NULL.
                 *
                 *     ```json
                 *     {
                 *       "data": [] // MUST NOT be null
                 *     }
                 *     ```
                 *      */
                200: {
                    headers: {
                        /** @description Link header to next result set. See [[#pagination]]. */
                        link?: string;
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description List of <{ProductFootprint}> objects. */
                            data: components["schemas"]["ProductFootprint"][];
                        };
                    };
                };
                400: components["schemas"]["BadRequestResponse"];
                401: components["schemas"]["UnauthorizedResponse"];
                403: components["schemas"]["ForbiddenResponse"];
                500: components["schemas"]["InternalErrorResponse"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/3/footprints/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Action GetFootprint
         * @description Retrieve a single Product Carbon Footprint (PCF) by its unique identifier.
         *
         *     If the requested ProductFootprint is deprecated, the host system SHOULD
         *     return the deprecated ProductFootprint, if it is still available.
         *
         *     If the requested ProductFootprint is not found, the host system MUST return
         *     a 404 Not Found response.
         *
         *     Host systems SHOULD implement an access management system and only
         *     return the product footprints for which the data owner granted access
         *     to the requesting data recipient.
         *
         *     If it determines that a data recipient is not allowed to access the requested
         *     ProductFootprint, the host system MUST return a 403 Forbidden response.
         *
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    /** @description The value of property id of a product footprint a data recipient intends to retrieve. */
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Indicates success: the product footprint was found and returned
                 *     by the host system.
                 *
                 *     Example response body:
                 *
                 *     ```json
                 *     {
                 *       "data": {
                 *         "id": "079e425a-464f-528d-341d-4a944a1dfd70",
                 *         "productIds": ["urn:pact:sample.com:product-id:44055-9c05bc35-68f8"]},
                 *         "productNameCompany": "Sample Product",
                 *         ...
                 *       }
                 *     }
                 *     ```
                 *      */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @description The product footprint requested, see <{ProductFootprint}>.
                             *      */
                            data: components["schemas"]["ProductFootprint"];
                        };
                    };
                };
                400: components["schemas"]["BadRequestResponse"];
                401: components["schemas"]["UnauthorizedResponse"];
                /** @description The data recipient is not allowed to access the requested ProductFootprint.
                 *
                 *     Response body MUST contain a JSON <{Error}> object
                 *      */
                403: components["schemas"]["ForbiddenResponse"];
                /** @description The requested ProductFootprint was not found.
                 *
                 *     Response body MUST contain a JSON <{Error}> object
                 *      */
                404: components["schemas"]["NotFoundResponse"];
                500: components["schemas"]["InternalErrorResponse"];
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/3/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Action Events
         * @description The Action Events endpoint supports the following use cases:
         *
         *      1. enabling a [=data recipient=] to request Product Footprints
         *         from a [=data owner=] by sending a `RequestCreatedEvent`, to
         *         which the data owner can answer by sending `RequestFulfilledEvent`
         *         or a `RequestRejectedEvent`.
         *      2. enabling a [=data owner=] to notify a [=data recipient=] on
         *         updates to 1 or more Product Footprints: `PublishedEvent`
         *
         *     The Action Events endpoint accepts CloudEvent events (see [[!CE]] and [[!CE-JSON]]) encoded
         *     in "Structured Content Mode" (see [[!CE-Structured-Content-Mode]]).
         *
         *     The CloudEvents are encoded in the "application/cloudevents+json" media type and
         *     MUST be sent as an HTTP POST request body to the Action Events endpoint.
         *
         *     The following events MUST be handled by the host system:
         *     - [`RequestCreatedEvent`](#request-created-event)
         *     - [`RequestFulfilledEvent`](#request-fulfilled-event)
         *     - [`RequestRejectedEvent`](#request-rejected-event)
         *     - [`PublishedEvent`](#published-event)
         *
         *     A host system MUST validate the event and return an HTTP 4xx status code if the
         *     event is invalid.
         *
         *     Upon accepting the event, the [=host system=] MUST return an HTTP 200 status code
         *     and SHOULD return an empty response body.
         *
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/cloudevents+json": components["schemas"]["RequestCreatedEvent"] | components["schemas"]["RequestFulfilledEvent"] | components["schemas"]["RequestRejectedEvent"] | components["schemas"]["PublishedEvent"];
                };
            };
            responses: {
                /** @description
                 *     Indicates success: the event was accepted by the host system. The response
                 *     body will be empty.
                 *      */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                400: components["schemas"]["BadRequestResponse"];
                401: components["schemas"]["UnauthorizedResponse"];
                403: components["schemas"]["ForbiddenResponse"];
                500: components["schemas"]["InternalErrorResponse"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * ProductFootprint
         * The ProductFootprint represents the footprint of a product.
         *
         * @description `ProductFootprint` is a data type which represents the carbon footprint
         *     of a product under a specific scope ([[#dt-carbonfootprint-scope]])
         *     and with values calculated in accordance with the [=PACT Methodology=].
         *
         *     The objective of a `ProductFootprint` is to provide interoperability between
         *     the creator (the [=data owner=]) and the consumer (the [=data recipient=]) of
         *     ProductFootprints. The details on the exchange of ProductFootprints are
         *     specified in [[#api]].
         *
         *     Conceptually, the data type <{ProductFootprint}> is modeled as a multi-purpose
         *     container for product-specific emission factors which is supported by
         *     extensibility through [=Data Model Extensions=].
         *
         *     Data Model Extensions enable [=data owners=] to exchange additional information
         *     related to a product with [=data recipients=]. The details are specified
         *     in [[#datamodelextension]] as well as [[!EXTENSIONS-GUIDANCE]], and [[!DATA-MODEL-EXTENSIONS]].
         *
         *     Each `ProductFootprint` can and should be updated over time, for instance to
         *     incorporate new or refined data from [=data owners=] (see [[#lifecycle]]).
         *
         */
        ProductFootprint: {
            /**
             * Format: uuid
             * @description A unique identifier that a system uses to refer to the entire dataset of the PCF.
             *     This is typically an automatically-generated number by the solution to maintain
             *     the required technical references to data within the system.
             *
             * @example f4b1225a-bd44-4c8e-861d-079e4e1dfd69
             */
            id: string;
            /**
             * @description The version of the PACT Technical Specifications that the data being shared complies with.
             *     This is a string in the format of "major.minor.patch" (e.g. "3.0.0").
             *
             * @example 3.0.0
             */
            specVersion: string;
            /**
             * @description A given PCF may change over time, due to updates to the calculation.
             *     This is a list of IDs that reflect "past versions" of the current PCF,
             *     maintained by the solution. If defined, MUST be non-empty set of IDs.
             *
             *     See [[#lifecycle]] for details.
             *
             * @example [
             *       "f4b1225a-bd44-4c8e-861d-079e4e1dfd69",
             *       "079e425a-464f-528d-341d-4a944a1dfd70"
             *     ]
             */
            precedingPfIds?: string[];
            /**
             * Format: date-time
             * @description The date and time when the PCF was created. This is typically an automatically
             *     generated field by the solution. It SHOULD NOT be used to derive status of
             *     validity of the PCF.
             *
             *     See [[#lifecycle]] for details.
             *
             * @example 2024-10-31T00:00:00Z
             */
            created: string;
            /**
             * @description The status of the PCF. `Active` means that the PCF is the most recent version
             *     and is the one that SHOULD be used by a data recipient, e.g. for product
             *     footprint calculations. `Deprecated` means that the PCF is no longer
             *     the most recent version and SHOULD NOT be used by data recipients.
             *
             *     See [[#lifecycle]] for details.
             *
             * @example Active
             * @enum {string}
             */
            status: "Active" | "Deprecated";
            /**
             * The start date and time of the validity period. The period of time between the
             *     validityPeriodStart and validityPeriodEnd is defined as the "validity period",
             *     and represents the time period during which the PCF is valid. Specifying the
             *     validity period is optional. If this is not specified, then it is assumed the
             *     PCF is valid for 3 years, starting from the referencePeriodEnd.
             *
             * Format: date-time
             * @description The start date of the validity period: the time interval during which the
             *     ProductFootprint is declared as valid for use by a receiving [=data recipient=].
             *
             *     If no validity period is specified, the ProductFootprint is valid for 3 years after
             *     the <{CarbonFootprint/referencePeriodEnd}>
             *
             *     See [[#validity-period]] for details.
             *
             */
            validityPeriodStart?: string;
            /**
             * Format: date-time
             * @description The end date and time of the validity period. After this date the ProductFootprint
             *     is not valid for use anymore. See [[#validity-period]] for more details.
             *
             */
            validityPeriodEnd?: string;
            /** @description The name of the company that is the PCF Data Owner
             *      */
            companyName: components["schemas"]["NonEmptyString"];
            /**
             * A list of company identifiers which represent the companies that are considered
             *     data owners of the PCF. In a large organization, this may include multiple
             *     subsidiaries or legal entities of a given corporation, hence the need to provide
             *     multiple identifiers. A list of only one identifier is also valid. The format
             *     of each companyID MUST be provided as a Uniform Resource Names ([[!RFC8141|URN]]),
             *     which helps ensure the data provided is standardized and can be interpreted by the
             *     receiving system.
             *
             * @description The non-empty set of Uniform Resource Names ([[!RFC8141|URN]]). Each value of
             *     this set is supposed to uniquely identify the ProductFootprint Data Owner.
             *
             * @example [
             *       "urn:company:example:company1"
             *     ]
             * @example [
             *       "urn:company:example:company1",
             *       "urn:company:example:company2"
             *     ]
             */
            companyIds: components["schemas"]["Urn"][];
            /** @description The free-form description of the product, including any additional relevant information
             *     such as production technology, packaging, process, feedstock and technical parameters
             *     (e.g. dimensions). Products which are services (i.e. consulting) should include a short
             *     description of the service.
             *      */
            productDescription: string;
            /**
             * All relevant product identifiers to identify the product for which the provided
             *     PCF was calculated (e.g. supplier part number, GTIN, article number, batch number, etc.)
             *
             * @description The non-empty set of Product IDs in [[!RFC8141|URN]] format. Each of the values in the set is
             *     supposed to uniquely identify the product. See [[#product-identifier-urns]] for syntax and
             *     examples.
             *
             */
            productIds: components["schemas"]["Urn"][];
            /**
             * A list of classification or category identifiers in URN format. Use well known urn's here,
             *     or adhere to recommended urn:pact: format. For example UN CPC, CAS Numbr, CN Code etc.
             *
             *     This replaces the productCategoryCpc property from 2.0.
             *
             * @description The non-empty set of Product Classifications in [[!RFC8141|URN]] format. Each of the values
             *     in the set can classify the product as part of distinct groupings and categorizations.
             *     See [[#product-classification-urns]].
             *
             * @example [
             *       "urn:pact:productclassification:un-cpc:1234"
             *     ]
             * @example [
             *       "urn:pact:productclassification:un-cpc:1234",
             *       "urn:pact:productclassification:cas:1234"
             *     ]
             */
            productClassifications?: components["schemas"]["Urn"][];
            /** @description The name with which the company producing the product refers to it, i.e. the product's trade name.
             *     Recognizable by the receiver of the PCF information.
             *      */
            productNameCompany: components["schemas"]["NonEmptyString"];
            /** @description Any additional information related to the PCF. Whereas the property productDescription
             *     contains product-level information, comment should be used for information and instructions
             *     related to the calculation of the PCF, or other information which informs the ability to interpret
             *     (e.g. LUC not included as unable to calculate LUC), to audit, or to verify the PCF.
             *
             *
             *     Information explaining the current status of the PCF, what was changed since the last version, etc. If the PCF was changed since a previous version, indicate all methodological and/or production process change(s) that occurred to result in the PCF change. For example, include the relevant change(s) from the list below:
             *
             *     1. In case product or sector specific guidance used does not align with PACT Methodology's requirement, the areas of disalignment should be specified in the comment section (e.g. allocation rules, exemption rules, data quality metrics).
             *
             *     2. Information explaining the current status of the PCF, what was changed since the last version, etc. If the PCF was changed since a previous version, indicate all methodological and/or production process change(s) that occurred to result in the PCF change. E.g., include the relevant change(s) from the list below:
             *
             *     Methodological:
             *      - Access to new Emission Factor data (database, supplier-specific, company-specific)
             *      - Updated upstream data (i.e. upstream supplier updated their PCF based on methodology change)
             *
             *     Production Process:
             *      - Change in process
             *      - Change in feedstock
             *      - Change from conventional to certified sustainable material
             *      - Change in energy source
             *      - Change in upstream supplier
             *      - Updated upstream data (i.e. upstream supplier updated their PCF based on process change)
             *
             *      3. Additional information on biogenic emissions & removals calculation  should be specified. This includes information on tools used for  calculations (e.g. Cool Farm Tool), and methodological choices made in calculation of biogenic emissions and removals (e.g. Statistical  or Direct Land use change calculation for DLUC calculations).
             *      */
            comment?: string;
            /**
             * The carbon footprint of the given product.
             * @description The carbon footprint of the given product with value conforming to the data
             *     type <{CarbonFootprint}>.
             *
             */
            pcf: components["schemas"]["CarbonFootprint"];
            /** @description If defined, 1 or more data model extensions associated with the ProductFootprint.
             *     See <{DataModelExtension}> for details.
             *      */
            extensions?: components["schemas"]["DataModelExtension"][];
        };
        /**
         * CarbonFootprint
         * The CarbonFootprint represents the carbon footprint of a product and related data
         *     in accordance with the PACT Methodology.
         *
         * @description A CarbonFootprint represents the carbon footprint of a product and related data in accordance with the [=PACT Methodology=].
         *
         *     ### Scope of a CarbonFootprint ### {#dt-carbonfootprint-scope}
         *
         *     Each CarbonFootprint is scoped by
         *     1. Time Period: the time period is defined by the properties <{CarbonFootprint/referencePeriodStart}> and <{CarbonFootprint/referencePeriodEnd}> (see [=PACT Methodology=] section 3.2.3)
         *     2. Geography: further set by the properties <{CarbonFootprint/geographyRegionOrSubregion}>, <{CarbonFootprint/geographyCountry}>, and <{CarbonFootprint/geographyCountrySubdivision}> (see [=PACT Methodology=] section 3.2.3)
         *
         *     If a CarbonFootprint
         *     1. Has geographical granularity `Global`, then the properties <{CarbonFootprint/geographyCountry}> and <{CarbonFootprint/geographyRegionOrSubregion}> and <{CarbonFootprint/geographyCountrySubdivision}> MUST be `undefined`;
         *     2. Has a regional or sub-regional geographical granularity, then the property <{CarbonFootprint/geographyRegionOrSubregion}> MUST be `defined` and the properties <{CarbonFootprint/geographyCountry}> and <{CarbonFootprint/geographyCountrySubdivision}> MUST be `undefined`;
         *     3. Has a country-specific geographical granularity, then property <{CarbonFootprint/geographyCountry}> MUST be `defined` AND the properties <{CarbonFootprint/geographyRegionOrSubregion}> and <{CarbonFootprint/geographyCountrySubdivision}> MUST be `undefined`;
         *     4. Has a country subdivision-specific geographical granularity, then property <{CarbonFootprint/geographyCountrySubdivision}> MUST be `defined` AND the properties <{CarbonFootprint/geographyRegionOrSubregion}> and <{CarbonFootprint/geographyCountry}> MUST be `undefined`.
         *
         */
        CarbonFootprint: {
            /**
             * @description The unit of measurement of the product. Together with `declaredUnitAmount`
             *     this defines the 'declared unit' of the product. Emissions in this carbon
             *     footprint are expressed in kgCO2e per 'declared unit'.
             *
             *     For example: a PCF for a 12.5 liter bottle of Ethanol states 2 kg of CO2e in
             *     emissions. In this case the declared unit is 12.5 liter Ethanol, thus the
             *     `declaredUnitOfMeasurement` is "liter", and the `declaredUnitAmount` is "12.5".
             *     The `pcfIncludingBiogenicUptake` is "2.0" kgCO2e per "12.5 liter" of Ethanol.
             *
             * @example liter
             * @enum {string}
             */
            declaredUnitOfMeasurement: "liter" | "kilogram" | "cubic meter" | "kilowatt hour" | "megajoule" | "ton kilometer" | "square meter" | "piece" | "hour" | "megabit second";
            /**
             * The amount of units contained within the product to which the PCF refers.
             *     This is not representing the total annual quantity supplied (e.g. if the product is
             *     supplied in bulk in kg, which is the declared unit selected, the value MUST be 1)
             *
             * @description The amount of <{CarbonFootprint/declaredUnitOfMeasurement|units}> contained
             *     within the product to which the [[#carbonfootprint|PCF]] is referring.
             *
             *     For example: if the product is a car door weighing 80kg, `declaredUnitAmount`
             *     will be `80` and `declaredUnitOfMeasurement` will be `kilogram`.
             *
             * @example 12.5
             */
            declaredUnitAmount: components["schemas"]["PositiveNonZeroDecimal"];
            /**
             * @description The mass (in kg) of the product excluding packaging. The 'declared unit' is
             *     the `declaredUnitAmount` times `declaredUnitOfMeasurement`.
             *
             *     For example, if the declared unit is `piece`, this attribute MUST be populated
             *     with the mass of `declaredUnitAmount` pieces of the product. If the declared unit
             *     is `liter`, this attribute MUST be populated with the mass of `declaredUnitAmount`
             *     liters of the product.
             *
             *     If the product mass is not relevant (i.e. PCF is for an energy (kWh, MJ),
             *     logistics (ton.km) or service related product), this attribute SHALL be populated
             *     with `0`.
             *
             *     For the full list of declared units requiring to report a mass per declared unit
             *     attribute please refer to table 4 in the PACT Methodology.
             *
             * @example 9.86
             */
            productMassPerDeclaredUnit: components["schemas"]["Decimal"];
            /**
             * The start date and time of the earliest activity data used to calculate the
             *     PCF. This start date can be considered the start of the period over which
             *     the given PCF is referencing, or reporting on.
             *
             * Format: date-time
             * @description The start (inclusive) of the time boundary for which the PCF value
             *     is considered to be representative. Specifically, this start date
             *     represents the earliest date from which activity data was collected
             *     to include in the PCF calculation.
             *
             * @example 2025-04-30T00:00:00+00:00
             */
            referencePeriodStart: string;
            /**
             * The end date and time of the latest activity data used to calculate the PCF.
             *     This end date can be considered the end of the period over which the given
             *     PCF is referencing, or reporting on.
             *
             * Format: date-time
             * @description The end (exclusive) of the time boundary for which the PCF value is
             *     considered to be representative. Specifically, this end date
             *     represents the latest date from which activity data was collected
             *     to include in the PCF calculation.
             *
             * @example 2025-12-30T00:00:00Z
             */
            referencePeriodEnd: string;
            /**
             * The geographic representation of the PCF should be reported at different
             *     levels of granularity, depending on the preference of the data owner
             *     (e.g., at a plant, region, or country level). This attribute specifies
             *     the geographic region to which the PCF refers, i.e. "Africa",
             *     "Central Asia", etc.
             *
             * @description If present, the value MUST be one of the [=UN geographic regions=] or [=UN geographic subregions=]. See [[#dt-carbonfootprint-scope]] for further details. Additionally, see the [=PACT Methodology=] Section 3.2.3.
             *
             * @example Eastern Asia
             * @example Southern Europe
             * @enum {string}
             */
            geographyRegionOrSubregion?: "Africa" | "Americas" | "Asia" | "Europe" | "Oceania" | "Australia and New Zealand" | "Central Asia" | "Eastern Asia" | "Eastern Europe" | "Latin America and the Caribbean" | "Melanesia" | "Micronesia" | "Northern Africa" | "Northern America" | "Northern Europe" | "Polynesia" | "South-eastern Asia" | "Southern Asia" | "Southern Europe" | "Sub-Saharan Africa" | "Western Asia" | "Western Europe";
            /**
             * The geographic representation of the PCF should be reported at different levels
             *     of granularity, depending on the preference of the data owner (e.g., at a
             *     plant, region, or country level). This field indicates the country to which
             *     the PCF refers. The country name must be according to ISO 3166-1 alpha-2
             *     country code (https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)
             *
             * @description If present, the value MUST conform to the [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)
             *     country code.
             *     See [[#dt-carbonfootprint-scope]] for further details.
             *
             * @example US
             * @example DE
             */
            geographyCountry?: string;
            /**
             * The geographic representation of the PCF should be reported at different
             *     levels of granularity, depending on the preference of the data owner
             *     (e.g., at a plant, region, or country level). This attribute represents
             *     the most granular (i.e. "most specific") geography, i.e. the specific
             *     subdivision within a given country, for example New York State within
             *     the USA. Follows ISO 3166-2 (https://en.wikipedia.org/wiki/ISO_3166-2)
             *
             * @description If present, a [ISO 3166-2](https://en.wikipedia.org/wiki/ISO_3166-2) country and subdivision code. See [[#dt-carbonfootprint-scope]] for further details.
             *
             * @example US-CA
             * @example DE-BW
             */
            geographyCountrySubdivision?: string;
            /** @description Brief description of the processes attributable to each life cycle stage included
             *     in the PCF (e.g. electricity consumption for manufacturing), especially those
             *     that significantly contribute manufacturing steps of the product (including
             *     general description of used technologies).
             *      */
            boundaryProcessesDescription?: string;
            /**
             * @description The PCF of the product:
             *
             *     Including:
             *     - All fossil emissions (CO2, CH4, N2O, HFCs, SF6, NF3, PFCs, HFEs, PFPEs, CFCs and HCFSs) from stationary/mobile combustion, industrial processes and fugitive emissions
             *     - All land sector-related related emissions (CO2, N2O, PFCs)
             *     - All biogenic emissions (biogenic CH4, biogenic CO2)
             *     - Land management removals and technological removals
             *
             *     Excluding:
             *     - Biogenic Product CO2 uptake
             *
             * @example 5.14
             */
            pcfExcludingBiogenicUptake: components["schemas"]["Decimal"];
            /**
             * @description The PCF of the product:
             *
             *     Including:
             *     - All fossil emissions (CO2, CH4, N2O, HFCs, SF6, NF3, PFCs, HFEs, PFPEs, CFCs and HCFSs) from stationary/mobile combustion, industrial processes and fugitive emissions
             *     - All land sector-related related emissions (CO2, N2O, PFCs)
             *     - All biogenic emissions (biogenic CH4, biogenic CO2)
             *     - Land management removals and technological removals
             *     - Biogenic Product CO2 uptake
             *
             * @example -14.22
             */
            pcfIncludingBiogenicUptake: components["schemas"]["Decimal"];
            /** @description The fossil carbon content of the product (mass of carbon).
             *      */
            fossilCarbonContent: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description The biogenic carbon content of the product (mass of carbon).
             *      */
            biogenicCarbonContent?: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description The carbon content (both biogenic and fossil) from recycled material in the product (mass of carbon).
             *      */
            recycledCarbonContent?: components["schemas"]["PositiveOrZeroDecimal"];
            /**
             * The emissions from fossil sources as a result of fuel combustion, from fugitive
             *     emissions, and from process emissions.
             *
             * @description The emissions from fossil sources as a result of fuel combustion, from
             *     fugitive emissions, and from process emissions.
             *
             *     Expressed in kgCO2e per declared unit.
             *
             */
            fossilGhgEmissions: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description GHG emissions from land-use change, such as deforestation or conversion
             *     from natural forest to plantation forest, that cause carbon stock loss.
             *      */
            landUseChangeGhgEmissions?: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description Placeholder for indirect land use change causing displacement of food production, outside of value-chain
             *      */
            landCarbonLeakage?: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description Fossil CO2, N2O, fossil CH4, HFCs and PFCs emissions due to land
             *     management practices.
             *
             *     Note: `fossilGhgEmissions` already includes these emissions.
             *      */
            landManagementFossilGhgEmissions?: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description Biogenic CO2 emissions occurring due to recurring land management actions on
             *     land within the same land-use category.
             *      */
            landManagementBiogenicCO2Emissions?: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description Biogenic CO2 removals resulting from a net increase in carbon stored in land-based carbon
             *     pools (e.g. reforestation and afforestation). Subject to traceability requirements.
             *      */
            landManagementBiogenicCO2Removals?: components["schemas"]["NegativeOrZeroDecimal"];
            /** @description Temporary CO2 uptake of biomass in the product at point of leaving factory gate.
             *      */
            biogenicCO2Uptake?: components["schemas"]["NegativeOrZeroDecimal"];
            /** @description CH4 emissions from land management practices and  the oxidation and transformation or degradation of biomass.
             *      */
            biogenicNonCO2Emissions?: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description The amount of agricultural land occupied in the reporting year to produce the product.
             *      */
            landAreaOccupation?: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description If present, the GHG emissions resulting from aircraft engine usage
             *     for the transport of the product, excluding radiative forcing.
             *
             *     The aircraft emissions are excluding biogenic CO2 uptake.
             *      */
            aircraftGhgEmissions?: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description Indicates whether packaging emissions are included in the scope
             *     and boundary of the product carbon footprint.
             *
             *     If `true`, packaging emissions are included in the product carbon
             *     footprint, and the `packagingGhgEmissions` property SHOULD be defined.
             *
             *     If `false`, packaging emissions are not included in the product carbon
             *     footprint, and the `packagingGhgEmissions` property MUST be undefined.
             *      */
            packagingEmissionsIncluded?: boolean;
            /** @description Emissions resulting from the packaging of the product.
             *     SHOULD be defined if `packagingEmissionsIncluded` is true and MUST be
             *     undefined if `packagingEmissionsIncluded` is false.
             *
             *     Packaging emissions are excluding biogenic CO2 uptake.
             *      */
            packagingGhgEmissions?: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description The biogenic carbon content of the packaging (mass of carbon).
             *      */
            packagingBiogenicCarbonContent?: components["schemas"]["PositiveOrZeroDecimal"];
            /** @description Emissions resulting from outbound logistics should be calculated and reported
             *     separately up to the point where another company (e.g., customer)
             *     takes over responsibility for the product (i.e. own or pay for the outbound
             *     logistics). MUST be undefined if  the company calculating and exchanging the
             *     PCF is not responsible for the outbound logistics.
             *
             *     The outbound logistics emissions are excluding biogenic CO2 uptake.
             *      */
            outboundLogisticsGhgEmissions?: components["schemas"]["PositiveOrZeroDecimal"];
            /**
             * @description Indicates whether CCS (including BECCS) take place within the scope and boundary of the product carbon footprint.
             *
             *     If `true`, `ccsTechnologicalCO2Capture`, `technologicalCO2Removals` and `technologicalCO2CaptureOrigin` shall be defined if known and available.
             *
             *     If `false`, `ccsTechnologicalCO2Capture`, `technologicalCO2Removals` and `technologicalCO2CaptureOrigin` shall be undefined.
             *
             * @example false
             */
            ccsTechnologicalCO2CaptureIncluded?: boolean;
            /**
             * @description The amount of CO2 captured with Carbon Capture and Storage (CCS) technologies.
             *
             * @example -4.34
             */
            ccsTechnologicalCO2Capture?: components["schemas"]["NegativeOrZeroDecimal"];
            /** @description For CCU: Information about the origin (fossil or biogenic) and path of the captured CO2 used in CCU, including
             *     the name and location of the capture facility. This information enhances transparency and traceability,
             *     enabling tracking of CO2 across the value chain.
             *
             *     For CCS: Traceability data, i.e. information on location injection site, geological reservoir as part of the overall
             *     technological CO2 capture origin data point for the PCF.
             *      */
            technologicalCO2CaptureOrigin?: string;
            /** @description CO2 removed directly from the atmosphere or via biogenic CO2 capture. Subject to reporting requirements.
             *      */
            technologicalCO2Removals?: components["schemas"]["NegativeOrZeroDecimal"];
            /** @description The amount of captured carbon (both biogenic and fossil) during CCU (Carbon Capture & Usage) in the product.
             *      */
            ccuCarbonContent?: components["schemas"]["PositiveOrZeroDecimal"];
            /**
             * @description The calculation approach for CCU: "Cut-off" or "Credit."
             *
             * @enum {string}
             */
            ccuCalculationApproach?: "Cut-off" | "Credit";
            /** @description (Only for Credit Approach) a URL to documentation verifying the certification from an external bookkeeping scheme.
             *     This attribute ensures reliability and avoids double counting of credits within the crediting system.
             *      */
            ccuCreditCertification?: components["schemas"]["Uri"];
            /**
             * The IPCC (Intergovernmental Panel of Climate Change) frequently releases (GWP)
             *     global warming potential values for climate gases related to CO2. These GWP
             *     values are released in Assessment Reports (AR), which are numbered.
             *
             *     The AR number can be used to track the age and accuracy of the GWP values used
             *     in reporting. This field indicates the IPCC version of the GWP characterization
             *     factors used in the calculation of the PCF.
             *
             *     Per the PACT Methodology, the latest available characterization factor version
             *     shall be used, i.e., [""AR6""]. In the event this is not possible, include the
             *     set of all characterization factors used.
             *
             * @description The characterization factors from one or more IPCC Assessment Reports used in the calculation of the PCF.
             *     It MUST be a non-empty set of strings with the format `AR$VERSION$`, where `$VERSION$` stands for the
             *     IPCC report version number and MUST be an integer.
             *
             *     Per the Methodology the latest available characterization factor version shall be used, i.e., `["AR6"]`. In the event this is not possible, include the set of all characterization factors used.
             *
             * @example [
             *       "AR6"
             *     ]
             * @example [
             *       "AR5",
             *       "AR6"
             *     ]
             */
            ipccCharacterizationFactors: string[];
            /**
             * The cross-sectoral standards applied for calculating or allocating GHG
             *     emissions. If multiple apply, list all.
             *
             * @description The cross-sectoral standards applied for calculating or allocating [=GHG=] emissions.
             *
             *     It MUST be a non-empty array and SHOULD contain only the following values without duplicates:
             *
             *       : `ISO14067`
             *       :: for the ISO 14067 Standard, "Greenhouse gases — Carbon footprint of products — Requirements and guidelines for quantification"
             *       : `ISO14083`
             *       :: for the ISO 14083 Standard, "Greenhouse gases — Quantification and reporting of greenhouse gas emissions arising from transport chain operations"
             *       : `ISO14040-44`
             *       :: for the ISO 14040-44 Standard, "Environmental management — Life cycle assessment — Principles and framework"
             *       : `GHGP-Product`
             *       :: for the Greehouse Gas Protocol (GHGP) Product Standard
             *       : `PEF`
             *       :: for the EU Product Environmental Footprint Guide
             *       : `PACT-1.0`
             *       : `PACT-2.0`
             *       : `PACT-3.0`
             *       :: for a given version of the [=PACT Methodology=]. It is recommended to use the latest version of the Methodology.
             *       : `PAS2050`
             *       :: for the Publicly Available Specification (PAS) 2050, "Specification for the assessment of the life cycle greenhouse gas emissions of goods and services". The use of this standard is permitted but not recommended.
             *
             *     The enumeration of standards above CAN evolve in future revisions. A host system MUST accept ProductFootprints from later revisions with `crossSectoralStandards` containing values that are not defined in this specification.
             *
             * @example [
             *       "ISO14067",
             *       "PACT-3.0"
             *     ]
             */
            crossSectoralStandards: string[];
            /**
             * The product-specific or sector-specific rules applied for calculating or
             *     allocating GHG emissions. Sector specific guidance frameworks, such as
             *     Product Category Rules (PCR), are sets of rules for how to calculate and
             *     document Life Cycle Assessments. They provide product category specific
             *     guidance and enhance comparability between assessments of the different
             *     suppliers for the same category (sector). The same applies to Product
             *     Environmental Footprint Category Rules (PEFCR)).  If no rules were used,
             *     leave this field empty.
             *
             * @description The product-specific or sector-specific rules applied for calculating or allocating GHG emissions. If no product or sector specific rules were followed, this set MUST be empty.
             *
             * @example [
             *       {
             *         "operator": "PEF",
             *         "ruleNames": [
             *           "PEF 1.0",
             *           "PEF 2.0"
             *         ]
             *       },
             *       {
             *         "operator": "PCR",
             *         "ruleNames": [
             *           "PCR-A"
             *         ]
             *       }
             *     ]
             */
            productOrSectorSpecificRules?: components["schemas"]["ProductOrSectorSpecificRule"][];
            /**
             * @description The percentage of emissions excluded from the PCF.
             *
             * @example 5.3
             * @example 10.4
             */
            exemptedEmissionsPercent: components["schemas"]["Decimal"];
            /**
             * If emissions exempted, rationale behind exclusion of specific PCF emissions.
             *
             * @description Rationale behind exclusion of specific PCF emissions, CAN be the empty string if no emissions were excluded.
             *
             */
            exemptedEmissionsDescription?: string;
            /** @description Description of the allocation rules applied to the PCFs foreground data
             *     including an explanation of the underlying reasons (way of allocating
             *     all activities from manufacturing steps to the declared unit).
             *      */
            allocationRulesDescription?: string;
            /**
             * The list of secondary data sources and versions which have been used by
             *     the data owner for the PCF calculation (e.g. databases such as ecoinvent)
             *
             *     If no secondary data is used, this property MUST BE undefined.
             *
             * @description If secondary data was used to calculate the <{CarbonFootprint}>, then it MUST include the property <{CarbonFootprint/secondaryEmissionFactorSources}> with value the emission factors used for the <{CarbonFootprint}> calculation.
             *
             *     If no secondary data is used, this property MUST BE undefined.
             *
             * @example [
             *       {
             *         "name": "ecoinvent",
             *         "version": "3.7"
             *       }
             *     ]
             */
            secondaryEmissionFactorSources?: components["schemas"]["EmissionFactorSource"][];
            /** @description Share of primary data in the final absolute PCF value excluding biogenic CO2 uptake (pcfExcludingBiogenicUptake).
             *      */
            primaryDataShare?: components["schemas"]["Decimal"];
            /** @description Data Quality Indicators (dqi) in accordance with the PACT Methodology.
             *      */
            dqi?: components["schemas"]["DataQualityIndicators"];
            /** @description The presence of the <{Verification}> object indicates whether or not the <{CarbonFootprint}> has
             *     been verified in line with [=PACT Methodology=] requirements.
             *      */
            verification?: components["schemas"]["Verification"];
        } & ((unknown | unknown | unknown) | unknown);
        /**
         * DataModelExtension
         * @description Each data model extension MUST be a valid JSON object conforming with the
         *     [JSON Representation of a Data Model Extension](https://wbcsd.github.io/data-model-extensions/spec/#instantiation).
         *
         *     See [[!DATA-MODEL-EXTENSIONS]] for technical details and [[!EXTENSIONS-GUIDANCE]] for data model extension guidance.
         *
         * @example Example imaginary Data Model Extension for encoding shipment-related data, encoded in JSON:
         *     ```json
         *     {
         *       "specVersion": "2.0.0",
         *       "dataSchema": "https://reg.carbon-transparency.org/shipment/1.0.0/data-model.json",
         *       "data": {
         *         "shipmentId": "S1234567890",
         *         "consignmentId": "Cabc.def-ghi",
         *         "shipmentType": "PICKUP",
         *         "weight": 10,
         *         "transportChainElementId": "ABCDEFGHI"
         *       }
         *     }
         *     ```
         *
         */
        DataModelExtension: {
            /** @description The version of the Data Model Extension specification. The value
             *     MUST be a string in the format major.minor.patch as defined in
             *     Semantic Versioning 2.0.0.
             *      */
            specversion?: string;
            /**
             * Format: uri
             * @description The value MUST be the URL to the publicly accessible Extension Schema File
             *
             */
            dataSchema: string;
            /**
             * Format: uri
             * @description The value MUST be the URL to the publicly accessible Extension Documentation.
             *
             */
            documentation?: string;
            /** @description The value MUST be a JSON Object that conforms to the extension schema file
             *     referenced by the dataSchema property.
             *      */
            data: Record<string, never>;
        };
        /**
         * ProductOrSectorSpecificRule
         * @description A ProductOrSectorSpecificRule refers to a set of product or sector specific rules published by a specific operator and applied during product carbon footprint calculation.
         *
         * @example ```json
         *     {
         *       "operator": "PEF",
         *       "ruleNames": [
         *         "PEF 1.0",
         *         "Other"
         *       ]
         *     }
         *     ```
         *
         */
        ProductOrSectorSpecificRule: {
            /**
             * @description Selection of operator of PCR being used for the PCF calculation. If
             *     operator is not available in the given list, or if a sector specific
             *     guidance has been followed, please set "Other" and include details
             *     under "otherOperatorName".
             *
             * @example PEF
             * @example Other
             * @enum {string}
             */
            operator: "PEF" | "EPD International" | "Other";
            /**
             * @description Names of the product or sector specific rules being used for the PCF
             *     calculation.
             *
             * @example [
             *       "PEF 1.0",
             *       "PEF 2.0"
             *     ]
             */
            ruleNames: string[];
            /** @description If operator is Other, then this attribute must be populated with the name
             *     of the operator.
             *      */
            otherOperatorName?: string;
        };
        /**
         * EmissionFactorSource
         * @description References emission factor databases, see [=PACT Methodology=] Section 4.1.3.2.
         *
         *     ```json
         *     {
         *       "name": "ecoinvent",
         *       "version": "3.9.1"
         *     }
         *     ```
         *
         */
        EmissionFactorSource: {
            /**
             * @description Name of the secondary emission factor database
             *
             * @example ecoinvent
             */
            name: components["schemas"]["NonEmptyString"];
            /**
             * @description Version of the secondary emission factor database
             *
             * @example 3.9.1
             */
            version: components["schemas"]["NonEmptyString"];
        };
        /**
         * DataQualityIndicators
         * @description Data type DataQualityIndicators contains the quantitative data quality indicators.
         *
         * @example Example value for the case that all DQIs are known but no coverage after exemption assessment performed:
         *
         *     ```json
         *     {
         *       "technologicalDQR": "5.0",
         *       "geographicalDQR": "2.0"
         *       "temporalDQR": "3.0",
         *     }
         *     ```
         *
         */
        DataQualityIndicators: {
            /** @description Quantitative data quality rating (DQR) based on the data quality matrix,
             *     scoring the technological representativeness of the sources used for
             *     the final absolute PCF excluding biogenic CO2 uptake calculation based
             *     on weighted average of all inputs.
             *
             *     The value MUST be between `1` and `5` inclusive.
             *      */
            technologicalDQR: components["schemas"]["Decimal"];
            /** @description Quantitative data quality rating (DQR) based on the data quality matrix,
             *     scoring the geographical representativeness of the sources used for
             *     the final absolute PCF excluding biogenic CO2 uptake calculation based on
             *     weighted average of all inputs.
             *
             *     The value MUST be between `1` and `5` inclusive.
             *      */
            geographicalDQR: components["schemas"]["Decimal"];
            /** @description Quantitative data quality rating (DQR) based on the data quality matrix,
             *     scoring the temporal representativeness of the sources used for
             *     the final absolute PCF excluding biogenic CO2 uptake calculation based on
             *     weighted average of all inputs.
             *
             *     The value MUST be between `1` and `5` inclusive.
             *      */
            temporalDQR: components["schemas"]["Decimal"];
        };
        /**
         * Verification
         * @description Contains the verification in conformance with the PACT Methodology.
         *
         * @example ```json
         *     {
         *       "coverage": "PCF program",
         *       "providerName": "My Auditor",
         *       "completedAt": "2025-04-08T14:47:32Z"
         *       "standardName": "ISO 14044"
         *     }
         *     ```
         *
         */
        Verification: {
            /**
             * @description The coverage of the verification defines the type and level of GHG data to be verified.
             *
             * @enum {string}
             */
            coverage?: "PCF calculation model" | "PCF program" | "product level";
            /** @description The non-empty name of the independent third party engaged to undertake the verification.
             *      */
            providerName?: string;
            /**
             * Format: date-time
             * @description The date at which the verification was completed
             *
             */
            completedAt?: string;
            /** @description Name of the standard against which the PCF was assured
             *      */
            standardName?: string;
            /** @description Any additional comments that will clarify the interpretation of the verification.
             *      */
            comments?: string;
        };
        NonEmptyString: string;
        /** Format: urn */
        Urn: string;
        /** Format: uri */
        Uri: string;
        /** Format: decimal */
        Decimal: string;
        /** Format: decimal */
        PositiveNonZeroDecimal: string;
        /** Format: decimal */
        PositiveOrZeroDecimal: string;
        /** Format: decimal */
        NegativeOrZeroDecimal: string;
        /** Format: decimal */
        NegativeNonZeroDecimal: string;
        /** @description Base class for all events, it follows the CloudEvents specification.
         *      */
        BaseEvent: {
            /** @description Event type identifier. */
            type: string;
            /** @description CloudEvents version. */
            specversion: string;
            /** @description Event identifier. Must be able to uniquely identify the event by source and id. */
            id: string;
            /** @description The domain and endpoint of the application from which the event originates. */
            source: string;
            /**
             * Format: date-time
             * @description The time the event occurred.
             */
            time: string;
            /** @description The event payload. */
            data: Record<string, never>;
        };
        /**
         * Published Event
         * @description Notification that a ProductFootprint has been published (either new or updated).
         *     This event is triggered by the [=data owner=] and send to relevant [=data recipients=].
         *
         *     If the [=data recipient=] cannot be reached by the [=data owner=], the data owner
         *     SHOULD retry to send the event at a later time, using an exponential backoff
         *     strategy. It SHOULD abandon sending the event after 72 hours.
         *
         *     The data object of the `PublishedEvent` contains the list of Product Footprint
         *     *IDs* that have been published or updated by the data owner.
         *
         *     The data recipient can retrieve the *actual* Product Footprints by calling the
         *     [=Action GetFootprint=] action on the data owner's systems.
         *
         * @example ```http
         *     POST /3/events HTTP/1.1
         *     Host: api.example.com
         *     Content-Type: application/cloudevents+json
         *     Authorizaton: Bearer xxxxxxxxxxxxx
         *
         *     {
         *       "type": "org.wbcsd.pact.ProductFootprint.PublishedEvent.3",
         *       "specversion": "1.0",
         *       "id": "1934405d-4f9b-4b3b-9c05bc35-68f8",
         *       "source": "//api.example.com/3/events",
         *       "time": "2022-05-31T17:31:00Z",
         *       "data": {
         *         "pfIds": ["079e425a-464f-528d-341d-4a944a1dfd70"]
         *       }
         *     }
         *     ```
         *
         */
        PublishedEvent: components["schemas"]["BaseEvent"];
        /**
         * Request Created Event
         * @description A data recipient requests a ProductFootprint from the data owner. The data recipient
         *     MUST provide the criteria in the data object to enable the data owner to either
         *     find an existing relevant PCF or create a new one.
         *
         *     Criteria to provide can be product id, geography, company identifier, validity
         *     period, etc, see below for details.
         *     For filtering logic, see [[#filtering]].
         *
         *     If the data owner can *immediately* determine that it will not be able to
         *     handle this request it MUST respond with an appropriate `4xx` error response,
         *     otherwise it MUST respond with a `200` (Success), indicating it will
         *     be able to process the request asynchronously.
         *
         *     Only in the latter case (after having accepted the request for processing) the data
         *     owner MUST send a follow-up event back to the data recipient at some time in the future.
         *     This follow up event MUST be either a `RequestFulfilledEvent` or `RequestRejectedEvent`.
         *
         * @example ```http
         *     POST /3/events HTTP/1.1
         *     Host: api.example.com
         *     Content-Type: application/cloudevents+json
         *     Authorizaton: Bearer xxxxxxxxxxxxx
         *
         *     {
         *       "type": "org.wbcsd.pact.ProductFootprint.RequestCreatedEvent.3",
         *       "specversion": "1.0",
         *       "id": "1934405d-4f9b-4b3b-9c05bc35-68f8",
         *       "source": "//api.example.com/3/events",
         *       "time": "2025-03-05T17:31:00Z",
         *       "data": {
         *         "productId": ["urn:pact:sample.com:product-id:44055-9c05bc35-68f8"],
         *         "geography": ["DE"],
         *         "validAfter": "2025-01-01T00:00:00Z"
         *       }
         *     }
         *     ```
         *
         */
        RequestCreatedEvent: components["schemas"]["BaseEvent"];
        /**
         * Request Fulfilled Event
         * @description Notification that the request for PCF(s) has been fulfilled by the data owner.
         *     This notification will be sent by the data owner back to the data recipient in
         *     response to a ProductFootprintRequest.Created event, see [[#request-created-event]].
         *
         *     The data object contains the original requestEventId and the resulting list of
         *     ProductFootprints which conform to the set of criteria specified by the data
         *     recipient in the preceding RequestCreated event. This list MUST be non-empty,
         *     as the RequestFulfilled event indicates success. The data owner MUST send
         *     a single RequestFulfilled event back to the data recipient per corresponding
         *     RequestCreated event.
         *
         *     If there are no product footprints to return, the data owner MUST send a
         *     [[#request-rejected-event]] instead.
         *
         *     If the [=data recipient=] cannot be reached by the [=data owner=], the data owner
         *     SHOULD retry to send the event at a later time, using an exponential backoff
         *     strategy. It SHOULD abandon sending the event after 72 hours.
         *
         * @example ```http
         *     POST /3/events HTTP/1.1
         *     Host: api.example.com
         *     Content-Type: application/cloudevents+json
         *     Authorizaton: Bearer xxxxxxxxxxxxx
         *
         *     {
         *       "type": "org.wbcsd.pact.ProductFootprint.RequestFulfilledEvent.3",
         *       "specversion": "1.0",
         *       "id": "505e5d-4f9b-4b3b-9c05bc35-68f8",
         *       "source": "//api.example.com/3/events",
         *       "time": "2025-03-05T17:31:00Z",
         *       "data": {
         *         "requestEventId": "1934405d-4f9b-4b3b-9c05bc35-68f8",
         *         "pfs": [
         *           {
         *             /* ProductFootprint object *\/
         *             "id": "079e425a-464f-528d-341d-4a944a1dfd70",
         *             "specVersion": "3.0",
         *             "productIds": ["urn:pact:sample.com:product-id:44055-9c05bc35-68f8"],
         *             ...
         *             "pcf": {
         *               ...
         *             }
         *           },
         *           {
         *             "id": "079e425a-464f-528d-341d-4a944a1dfd71",
         *             ...
         *           }
         *         ]
         *       }
         *     }
         *     ```
         *
         */
        RequestFulfilledEvent: components["schemas"]["BaseEvent"];
        /**
         * Request Rejected Event
         * @description Notification that a request for a ProductFootprint can not be fulfilled.
         *     The RequestRejectedEvent is an event sent back from the data owner to
         *     the data recipient upon NOT successfully fulfilling the preceding
         *     RequestCreatedEvent sent by the data recipient.
         *
         *     If the [=data recipient=] cannot be reached by the [=data owner=], the data owner
         *     SHOULD retry to send the event at a later time, using an exponential backoff
         *     strategy. It SHOULD abandon sending the event after 72 hours.
         *
         * @example ```http
         *     POST /3/events HTTP/1.1
         *     Host: api.example.com
         *     Content-Type: application/cloudevents+json
         *     Authorizaton: Bearer xxxxxxxxxxxxx
         *
         *     {
         *       "type": "org.wbcsd.pact.ProductFootprint.RequestRejectedEvent.3",
         *       "specversion": "1.0",
         *       "id": "505e5d-4f9b-4b3b-9c05bc35-68f8",
         *       "source": "//api.example.com/3/events",
         *       "time": "2025-03-05T17:31:00Z",
         *       "data": {
         *         "requestEventId": "1934405d-4f9b-4b3b-9c05bc35-68f8",
         *         "error": {
         *           "code": "NotFound",
         *           "message": "The requested footprint could not be found."
         *         }
         *       }
         *     }
         *     ```
         *
         */
        RequestRejectedEvent: components["schemas"]["BaseEvent"];
        /**
         * Error
         * @description Object with error code and description, to be returned by the API methods in case of error.
         *     See [[#api-error-handling]] for details.
         * @example ```json
         *     {
         *       "code": "NotFound",
         *       "message": "The requested footprint could not be found."
         *     }
         *     ```
         *
         */
        Error: {
            /**
             * @description Error code identifier.
             * @enum {string}
             */
            code: "BadRequest" | "AccessDenied" | "TokenExpired" | "NotFound" | "InternalError" | "NotImplemented";
            /** @description Human readable error message. */
            message: string;
        };
        /** @description Bad request.
         *
         *     Response body MUST contain a JSON <{Error}> object
         *      */
        BadRequestResponse: unknown;
        /** @description Not found.
         *
         *     Response body MUST contain a JSON <{Error}> object
         *      */
        NotFoundResponse: unknown;
        /** @description The request is not authorized, the access token is invalid or has expired.
         *
         *     Response body MUST contain a JSON <{Error}> object
         *      */
        UnauthorizedResponse: unknown;
        /** @description Token expired.
         *
         *     Response body MUST contain a JSON <{Error}> object
         *      */
        TokenExpiredResponse: unknown;
        /** @description Access Denied.
         *
         *     Response body MUST contain a JSON <{Error}> object
         *      */
        ForbiddenResponse: unknown;
        /** @description Not implemented.
         *
         *     Response body MUST contain a JSON <{Error}> object
         *      */
        NotImplementedResponse: unknown;
        /** @description Internal Error.
         *
         *     Response body MUST contain a JSON <{Error}> object
         *      */
        InternalErrorResponse: unknown;
    };
    responses: never;
    parameters: {
        /** @description One or more product IDs. Will return all footprints which have a corresponding ID in their `productIds` attribute. The match must be-case insensitive. Note that a footprint itself can also have multiple product IDs. */
        productId: components["schemas"]["Urn"][];
        /** @description One or more company IDs. Will return all footprints which have a corresponding ID in their `companyId` attribute. The match must be case-insensitive. Note that a footprint itself can also have multiple company IDs. */
        companyId: components["schemas"]["Urn"][];
        /** @description One or more geographic specifiers. Values specified can denote `geographyRegion` or `geographyCountry` or `geographyCountrySubdivision`. Will return all footprints within the specified geography(s). The match must be-case insensitive. */
        geography: string[];
        /** @description One or more product classifications. Will return all footprints with corresponding values in the `productClassifications` attribute. Note that a footprint itself can have multiple classifications. The match must be-case insensitive. */
        classification: components["schemas"]["Urn"][];
        /** @description If present, MUST match all PCFs which were valid on the date specified: start validity period <= validOn <= end validity period. See [[#validity-period]] for determining validity period.
         *      */
        validOn: string;
        /** @description If present, MUST match PCFs with a validity period start > validAfter.
         *     See [[#validity-period]] for determining validity period.
         *      */
        validAfter: string;
        /** @description If present, MUST match PCFs with a validity period end < validBefore
         *     See [[#validity-period]] for determining validity period.
         *      */
        validBefore: string;
        /** @description If present, MUST be "Active" or "Deprecated". If not specified, will return footprints regardless of status. The match must be-case insensitive.
         *      */
        status: "Active" | "Deprecated";
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
