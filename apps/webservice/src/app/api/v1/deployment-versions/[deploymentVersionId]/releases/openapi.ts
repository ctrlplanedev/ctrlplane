import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  components: {
    schemas: {
      Release: {
        type: "object",
        properties: {
          resource: { $ref: "#/components/schemas/Resource" },
          environment: { $ref: "#/components/schemas/Environment" },
          deployment: { $ref: "#/components/schemas/Deployment" },
          version: { $ref: "#/components/schemas/DeploymentVersion" },
          variables: { type: "object", additionalProperties: true },
        },
      },
    },
  },
  paths: {
    "/v1/deployment-versions/{deploymentVersionId}/releases": {
      get: {
        summary: "Get all releases for a deployment version",
        parameters: [
          {
            name: "deploymentVersionId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Release" },
                },
              },
            },
          },
          404: {
            description: "Not Found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                  required: ["error"],
                },
              },
            },
          },
          500: {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                  },
                  required: ["error"],
                },
              },
            },
          },
        },
      },
    },
  },
};
