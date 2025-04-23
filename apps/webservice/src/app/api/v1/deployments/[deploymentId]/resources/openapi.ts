import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/deployments/{deploymentId}/resources": {
      get: {
        summary: "Get resources for a deployment",
        operationId: "getResourcesForDeployment",
        parameters: [
          {
            name: "deploymentId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "UUID of the deployment",
          },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    resources: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Resource" },
                    },
                    count: { type: "number" },
                  },
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
                },
              },
            },
          },
        },
      },
    },
  },
};
