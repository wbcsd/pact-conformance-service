# PACT Tech Specs Test Cases - Expected Results

This document outlines the test cases used to validate PACT API V2 implementations, their expected responses, and example payloads.

To achieve conformance status for a given version of the Technical Specifications, a solution must pass all Mandatory test cases for that version.

## Test Case #1: Obtain auth token with valid credentials
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies the ability to obtain an authentication token using valid credentials.

Request:

- Method: `POST`
- Endpoint: `{AUTH_BASE_URL}/auth/token` or OpenID Connect URL
- Data: `grant_type=client_credentials`

Request headers:

```
Authorization: Basic [Base64EncodedClientCredentials]
Content-Type: application/x-www-form-urlencoded
```

Expected http status code: `200`

Example valid response body:

```
{
  "access_token": "eyJhbGciOiJSUzI...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## Test Case #2: Obtain auth token with invalid credentials
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies the system correctly rejects authentication attempts with invalid credentials.

Request:

- Method: `POST`
- Endpoint: `{AUTH_BASE_URL}/auth/token` or OpenID Connect URL
- Data: `grant_type=client_credentials`

Request headers:

```
Authorization: Basic [InvalidBase64EncodedClientCredentials]
Content-Type: application/x-www-form-urlencoded
```

Expected http status code: `400` or `401`

Example response body:

```
{
  "error": "invalid_client",
  "error_description": "Client authentication failed"
}
```

## Test Case #3: Get PCF using GetFootprint
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies the ability to retrieve a specific Product Carbon Footprint (PCF) by its ID.

Request:

- Method: `GET`
- Endpoint: `{API_BASE_URL}/2/footprints/{footprint_id}`

Request headers:

```
host: api.example.com
authorization: Bearer [BearerToken]
```

Expected http status code: `200`

Example valid response body:

```
{
  "data": {
    "id": "b1f8c0d2-7c4e-4e67-9a9c-2e4c12345678",
    "specVersion": "2.0.0",
    "version": 1,
    "created": "2023-01-15T10:15:30Z",
    "status": "Active",
    "validityPeriodStart": "2023-01-15T10:15:30Z",
    "validityPeriodEnd": "2025-12-31T00:00:00Z",
    "companyName": "Acme Corp",
    "companyIds": [
      "urn:uuid:abc12345-6789-4def-0123-456789abcdef",
      "urn:epc:id:sgln:123456.00000.1"
    ],
    "productDescription": "Renewable Diesel, soybean feedstock (bulk - no packaging)",
    "productIds": ["urn:gtin:1234567890123"]
  }
}
```

## Test Case #4: Get all PCFs using ListFootprints
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies the ability to retrieve a list of all Product Carbon Footprints.

Request:

- Method: `GET`
- Endpoint: `{API_BASE_URL}/2/footprints`

Request headers:

```
host: api.example.com
authorization: Bearer [BearerToken]
```

Expected http status code: `200` or `202`

Example valid response body:

```
{
  "data": [
    {
      "id": "b1f8c0d2-7c4e-4e67-9a9c-2e4c12345678",
      "specVersion": "2.0.0",
      "version": 1,
      "created": "2023-01-15T10:15:30Z",
      "status": "Active",
      "validityPeriodStart": "2023-01-15T10:15:30Z",
      "validityPeriodEnd": "2025-12-31T00:00:00Z",
      "companyName": "Acme Corp",
      "companyIds": [
        "urn:uuid:abc12345-6789-4def-0123-456789abcdef",
        "urn:epc:id:sgln:123456.00000.1"
      ],
      "productDescription": "Renewable Diesel, soybean feedstock (bulk - no packaging)",
      "productIds": ["urn:gtin:1234567890123"]
    },
    {
      "id": "c2e9d1f3-8d5f-5f78-0b0d-3f5e23456789",
      "specVersion": "2.0.0",
      "version": 1,
      "created": "2023-01-16T14:30:45Z",
      "status": "Active",
      "validityPeriodStart": "2023-01-16T14:30:45Z",
      "validityPeriodEnd": "2025-12-31T00:00:00Z",
      "companyName": "Acme Corp",
      "companyIds": [
        "urn:uuid:abc12345-6789-4def-0123-456789abcdef"
      ],
      "productDescription": "Bio-Ethanol (bulk - no packaging)",
      "productIds": ["urn:gtin:1234567890456"]
    }
  ]
}
```

## Test Case #5: Pagination link implementation of Action ListFootprints
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies the pagination functionality for the ListFootprints API.

Request:

- Method: `GET`
- Endpoint: `{API_BASE_URL}/2/footprints?page=2` or pagination URL from response links

Request headers:

```
host: api.example.com
authorization: Bearer [BearerToken]
```

Expected http status code: `200`

Example valid response body:

```
{
  "data": [
    {
      "id": "d3f0e2g4-9e6f-6g89-1c2d-4f6g78901234",
      "specVersion": "2.0.0",
      "version": 1,
      "created": "2023-01-17T09:45:15Z",
      "status": "Active",
      "validityPeriodStart": "2023-01-17T09:45:15Z",
      "validityPeriodEnd": "2025-12-31T00:00:00Z",
      "companyName": "Acme Corp",
      "companyIds": [
        "urn:uuid:abc12345-6789-4def-0123-456789abcdef"
      ],
      "productDescription": "Biodiesel (bulk - no packaging)",
      "productIds": ["urn:gtin:1234567890789"]
    }
  ]
}
```

Response headers:

```

Link: <{API_BASE_URL}/2/footprints?offset=1&limit=10>; rel="first", <{API_BASE_URL}/2/footprints?offset=1&limit=10>; rel="prev", <{API_BASE_URL}/2/footprints?offset=3&limit=10>; rel="next", <{API_BASE_URL}/2/footprints?offset=5&limit=10>; rel="last"

```

## Test Case #6: Attempt ListFootPrints with Invalid Token
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies the API correctly rejects requests with invalid authentication tokens.

Request:

- Method: `GET`
- Endpoint: `{API_BASE_URL}/2/footprints`

Request headers:

```
host: api.example.com
authorization: Bearer invalid-access-token
```

Expected http status code: `400`

Example response body:

```
{
  "code": "BadRequest",
  "message": "Invalid token provided"
}
```

## Test Case #7: Attempt GetFootprint with Invalid Token
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies the API correctly rejects specific footprint requests with invalid authentication tokens.

Request:

- Method: `GET`
- Endpoint: `{API_BASE_URL}/2/footprints/{footprint_id}`

Request headers:

```
host: api.example.com
authorization: Bearer invalid-access-token
```

Expected http status code: `400`

Example response body:

```
{
  "code": "BadRequest",
  "message": "Invalid token provided"
}
```

## Test Case #8: Attempt GetFootprint with Non-Existent PfId
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies the API correctly responds when requesting a non-existent footprint ID.

Request:

- Method: `GET`
- Endpoint: `{API_BASE_URL}/2/footprints/non-existent-id`

Request headers:

```
host: api.example.com
authorization: Bearer [BearerToken]
```

Expected http status code: `404`

Example response body:

```
{
  "code": "NoSuchFootprint",
  "message": "Footprint with ID 'non-existent-id' does not exist"
}
```

## Test Case #9: Attempt Authentication through HTTP (non-HTTPS)
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies that authentication is rejected when attempted over non-secure HTTP.

Request:

- Method: `POST`
- Endpoint: `http://{AUTH_BASE_URL}/auth/token` (note: HTTP instead of HTTPS)
- Data: `grant_type=client_credentials`

Request headers:

```
Authorization: Basic [Base64EncodedClientCredentials]
Content-Type: application/x-www-form-urlencoded
```

Expected behavior: Connection should be rejected or response should not include authentication tokens

## Test Case #10: Attempt ListFootprints through HTTP (non-HTTPS)
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies that API calls are rejected when attempted over non-secure HTTP.

Request:

- Method: `GET`
- Endpoint: `http://{API_BASE_URL}/2/footprints` (note: HTTP instead of HTTPS)

Request headers:

```
host: api.example.com
authorization: Bearer [BearerToken]
```

Expected behavior: Connection should be rejected or response should not include data property

## Test Case #11: Attempt GetFootprint through HTTP (non-HTTPS)
_Mandatory: V2.0, V2.1, V2.2, V2.3_

This test verifies that specific footprint requests are rejected when attempted over non-secure HTTP.

Request:

- Method: `GET`
- Endpoint: `http://{API_BASE_URL}/2/footprints/{footprint_id}` (note: HTTP instead of HTTPS)

Request headers:

```
host: api.example.com
authorization: Bearer [BearerToken]
```

Expected behavior: Connection should be rejected or response should not include data property

## Test Case #12: Receive Asynchronous PCF Request
_Mandatory: V2.2, V2.3_

This test verifies the ability to receive asynchronous PCF requests in CloudEvents format.

Request:

- Method: `POST`
- Endpoint: `{API_BASE_URL}/2/events`

Request headers:

```
Content-Type: application/cloudevents+json; charset=UTF-8
authorization: Bearer [BearerToken]
```

Request body:

```
{
  "specversion": "1.0",
  "id": "test-run-id-12345",
  "source": "https://webhook.example.com",
  "time": "2023-05-19T10:30:00Z",
  "type": "org.wbcsd.PACT.ProductFootprintRequest.Created.v1",
  "data": {
    "pf": {
      "productIds": ["urn:gtin:1234567890123"]
    },
    "comment": "Please send PCF data for this year."
  }
}
```

Expected http status code: `200`

Example response body:

```
{
  "status": "accepted",
  "message": "Event successfully processed"
}
```

## Test Case #13: Respond to PCF Request Fulfilled Event
_Mandatory: V2.2, V2.3_

This test verifies the ability to respond with appropriate status when receiving event notifications that fulfill a previously created PCF request.

Request:

- Method: `POST`
- Endpoint: `{API_BASE_URL}/2/events`

Request headers:

```
Content-Type: application/cloudevents+json; charset=UTF-8
authorization: Bearer [BearerToken]
```

Request body:

```
{
  "type": "org.wbcsd.PACT.ProductFootprintRequest.Fulfilled.v1",
  "specversion": "1.0",
  "id": "505e5d-4f9b-4b3b-9c05bc35-68f8",
  "source": "https://webhook.example.com",
  "time": "2023-05-19T11:00:00Z",
  "data": {
    "requestEventId": "test-run-id-12345",
    "pfs": [
      {
        "id": "b1f8c0d2-7c4e-4e67-9a9c-2e4c12345678",
        "specVersion": "2.0.0",
        "version": 1,
        "created": "2023-01-15T10:15:30Z",
        "status": "Active",
        "validityPeriodStart": "2023-01-15T10:15:30Z",
        "validityPeriodEnd": "2025-12-31T00:00:00Z",
        "companyName": "Acme Corp",
        "companyIds": [
          "urn:uuid:abc12345-6789-4def-0123-456789abcdef"
        ],
        "productDescription": "Renewable Diesel, soybean feedstock (bulk - no packaging)",
        "productIds": ["urn:gtin:1234567890123"],
        "pcf": {
          "declaredUnit": "liter",
          "unitaryProductAmount": 1,
          "pCfExcludingBiogenic": 2.56,
          "fossilGhgEmissions": 2.56,
          "fossilCarbonContent": 0,
          "biogenicCarbonContent": 0,
          "characterizationFactors": "AR5",
          "ipccCharacterizationFactorsSources": "AR5",
          "crossSectoralStandardsUsed": ["GHG Protocol Product standard"],
          "boundaryProcessesDescription": "Cradle-to-gate",
          "referencePeriodStart": "2022-01-01T00:00:00Z",
          "referencePeriodEnd": "2022-12-31T23:59:59Z",
          "exemptedEmissionsPercent": 0,
          "exemptedEmissionsDescription": "No exemptions",
          "packagingEmissionsIncluded": false
        }
      }
    ]
  }
}
```

Expected http status code: `200`

Example response body:

```
{
  "status": "accepted",
  "message": "Event successfully processed"
}
```

## Test Case #14: Respond to PCF Request Rejected Event
_Mandatory: V2.2, V2.3_

This test verifies the ability to respond with appropriate status when receiving event notifications that reject a previously created PCF request.

Request:

- Method: `POST`
- Endpoint: `{API_BASE_URL}/2/events`

Request headers:

```
Content-Type: application/cloudevents+json; charset=UTF-8
authorization: Bearer [BearerToken]
```

Request body:

```
{
  "type": "org.wbcsd.PACT.ProductFootprintRequest.Rejected.v1",
  "specversion": "1.0",
  "id": "505e5d-4f9b-4b3b-9c05bc35-68f8",
  "source": "https://webhook.example.com",
  "time": "2023-05-19T11:00:00Z",
  "data": {
    "requestEventId": "test-run-id-12345",
    "error": {
      "code": "NotFound",
      "message": "The requested footprint could not be found."
    }
  }
}
```

Expected http status code: `200`

Example response body:

```
{
  "status": "accepted",
  "message": "Event successfully processed"
}
```

## Test Case #15: Receive Notification of PCF Update (Published Event)
_Mandatory: None_

This test verifies the ability to receive notifications of PCF updates in CloudEvents format.

Request:

- Method: `POST`
- Endpoint: `{API_BASE_URL}/2/events`

Request headers:

```
Content-Type: application/cloudevents+json; charset=UTF-8
authorization: Bearer [BearerToken]
```

Request body:

```
{
  "type": "org.wbcsd.PACT.ProductFootprint.Published.v1",
  "specversion": "1.0",
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "source": "https://webhook.example.com",
  "time": "2023-05-19T11:30:00Z",
  "data": {
    "pfIds": ["urn:gtin:4712345060507"]
  }
}
```

Expected http status code: `200`

Example response body:

```
{
  "status": "accepted",
  "message": "Event successfully processed"
}
```

## Test Case #16: Attempt Action Events with Invalid Token
_Mandatory: V2.2, V2.3_

This test verifies the API correctly rejects event requests with invalid authentication tokens.

Request:

- Method: `POST`
- Endpoint: `{API_BASE_URL}/2/events`

Request headers:

```
Content-Type: application/cloudevents+json; charset=UTF-8
authorization: Bearer invalid-access-token
```

Request body:

```
{
  "type": "org.wbcsd.PACT.ProductFootprint.Published.v1",
  "specversion": "1.0",
  "id": "test-run-id-12345",
  "source": "https://webhook.example.com",
  "time": "2023-05-19T12:30:00Z",
  "data": {
    "pfIds": ["urn:gtin:4712345060507"]
  }
}
```

Expected http status code: `400`

Example response body:

```
{
  "code": "BadRequest",
  "message": "Invalid token provided"
}
```

## Test Case #17: Attempt Action Events through HTTP (non-HTTPS)
_Mandatory: V2.2, V2.3_

This test verifies that event endpoints are rejected when attempted over non-secure HTTP.

Request:

- Method: `POST`
- Endpoint: `http://{API_BASE_URL}/2/events` (note: HTTP instead of HTTPS)

Request headers:

```
Content-Type: application/cloudevents+json; charset=UTF-8
authorization: Bearer [BearerToken]
```

Request body:

```
{
  "specversion": "1.0",
  "id": "test-run-id-12345",
  "source": "https://webhook.example.com",
  "time": "2023-05-19T13:30:00Z",
  "type": "org.wbcsd.PACT.ProductFootprint.Published.v1",
  "data": {
    "pf": {
      "productIds": ["urn:gtin:4712345060507"]
    },
    "comment": "Please send PCF data for this year."
  }
}
```

Expected behavior: Connection should be rejected or response should not include data property

## Test Case #18: OpenId Connect-based Authentication Flow
_Mandatory: None_

This test verifies the OpenID Connect authentication flow with valid credentials.

Request:

- Method: `POST`
- Endpoint: `{OIDC_URL}`
- Data: `grant_type=client_credentials`

Request headers:

```
Authorization: Basic [Base64EncodedClientCredentials]
Content-Type: application/x-www-form-urlencoded
```

Expected http status code: `200`

Example valid response body:

```
{
  "access_token": "eyJhbGciOiJSUzI...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "PACT.read"
}
```

## Test Case #19: OpenId connect-based authentication flow with incorrect credentials
_Mandatory: None_

This test verifies the OpenID Connect authentication flow correctly rejects invalid credentials.

Request:

- Method: `POST`
- Endpoint: `{OIDC_URL}`
- Data: `grant_type=client_credentials`

Request headers:

```
Authorization: Basic [InvalidBase64EncodedClientCredentials]
Content-Type: application/x-www-form-urlencoded
```

Expected http status code: `400` or `401`

Example response body:

```
{
  "error": "invalid_client",
  "error_description": "Client authentication failed"
}
```

## Test Case #20: Get Filtered List of Footprints
_Mandatory: None_

This test verifies the filtering capabilities of the ListFootprints API.

Request:

- Method: `GET`
- Endpoint: `{API_BASE_URL}/2/footprints?$filter=created ge '2023-01-15T10:15:30Z'`

Request headers:

```
host: api.example.com
authorization: Bearer [BearerToken]
```

Expected http status code: `200`

Example valid response body:

```
{
  "data": [
    {
      "id": "b1f8c0d2-7c4e-4e67-9a9c-2e4c12345678",
      "specVersion": "2.0.0",
      "version": 1,
      "created": "2023-01-15T10:15:30Z",
      "status": "Active",
      "validityPeriodStart": "2023-01-15T10:15:30Z",
      "validityPeriodEnd": "2025-12-31T00:00:00Z",
      "companyName": "Acme Corp",
      "companyIds": [
        "urn:uuid:abc12345-6789-4def-0123-456789abcdef"
      ],
      "productDescription": "Renewable Diesel, soybean feedstock (bulk - no packaging)",
      "productIds": ["urn:gtin:1234567890123"]
    },
    {
      "id": "c2e9d1f3-8d5f-5f78-0b0d-3f5e23456789",
      "specVersion": "2.0.0",
      "version": 1,
      "created": "2023-01-16T14:30:45Z",
      "status": "Active",
      "validityPeriodStart": "2023-01-16T14:30:45Z",
      "validityPeriodEnd": "2025-12-31T00:00:00Z",
      "companyName": "Acme Corp",
      "companyIds": [
        "urn:uuid:abc12345-6789-4def-0123-456789abcdef"
      ],
      "productDescription": "Bio-Ethanol (bulk - no packaging)",
      "productIds": ["urn:gtin:1234567890456"]
    }
  ]
}
```
