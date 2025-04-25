import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  components: {
    schemas: {
      ReleaseTarget: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          resource: { $ref: "#/components/schemas/Resource" },
          environment: { $ref: "#/components/schemas/Environment" },
          deployment: { $ref: "#/components/schemas/Deployment" },
        },
        required: ["id", "resource", "environment", "deployment"],
      },
    },
  },
  paths: {
    "/v1/resources/{resourceId}/release-targets": {
      get: {
        summary: "Get release targets for a resource",
        operationId: "getReleaseTargets",
        parameters: [
          {
            name: "resourceId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "The resource ID",
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ReleaseTarget" },
                },
              },
            },
          },
        },
      },
    },
  },
};
