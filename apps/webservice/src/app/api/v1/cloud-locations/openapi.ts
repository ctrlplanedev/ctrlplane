import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Cloud Regions Geo API",
    description: "API to get geographic data for cloud provider regions",
    version: "1.0.0",
  },
  paths: {
    "/api/v1/cloud-locations/{provider}": {
      get: {
        summary: "Get all regions for a specific cloud provider",
        description:
          "Returns geographic data for all regions of a specific cloud provider",
        operationId: "getCloudProviderRegions",
        parameters: [
          {
            name: "provider",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: ["aws", "gcp", "azure"],
            },
            description: "Cloud provider (aws, gcp, azure)",
          },
        ],
        responses: {
          "200": {
            description:
              "Successfully returned geographic data for cloud provider regions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: {
                    $ref: "#/components/schemas/CloudRegionGeoData",
                  },
                },
              },
            },
          },
          "404": {
            description: "Cloud provider not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Cloud provider 'unknown' not found",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      CloudRegionGeoData: {
        type: "object",
        required: ["timezone", "latitude", "longitude"],
        properties: {
          timezone: {
            type: "string",
            description: "Timezone of the region in UTC format",
            example: "UTC+1",
          },
          latitude: {
            type: "number",
            format: "float",
            description: "Latitude coordinate for the region",
            example: 50.1109,
          },
          longitude: {
            type: "number",
            format: "float",
            description: "Longitude coordinate for the region",
            example: 8.6821,
          },
        },
      },
    },
  },
};
