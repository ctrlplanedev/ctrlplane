import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/workspaces/slug/{workspaceSlug}": {
      get: {
        summary: "Get a workspace by slug",
        operationId: "getWorkspaceBySlug",
        parameters: [
          {
            name: "workspaceSlug",
            in: "path",
            required: true,
            schema: { type: "string", example: "my-workspace" },
          },
        ],
        responses: {
          "200": {
            description: "Workspace found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Workspace" },
              },
            },
          },
          "404": {
            description: "Workspace not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                },
              },
            },
          },
          "500": {
            description: "Internal server error",
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
