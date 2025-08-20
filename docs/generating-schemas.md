# Generating TypeScript schemas from OpenAPI

We make use of [OpenAPI TS](https://openapi-ts.dev/) to generate our schemas from the PACT OpenAPI Spec.

### How to generate

In order to generate a required version, simply run `npm generate:schema` which will prompt you the version for which you'd like to have the TS schema for.

The CLI will then download the OpenAPI yaml spec for that version and generate a file called `v<major>_<minor>.ts` under the `schemas` directory in the root directory of this project.
