import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/workspaces/{workspaceId}/resources/{filter}": {
      get: {
        summary: "Get resources by filter",
        operationId: "getResourcesByFilter",
        parameters: [
          {
            name: "workspaceId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID of the workspace",
          },
          {
            name: "filter",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Filter to apply to the resources",
          },
        ],
        responses: {
          "200": {
            description: "Resources",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Resource" },
                },
              },
            },
          },
          "400": {
            description: "Invalid filter",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
  },
};
