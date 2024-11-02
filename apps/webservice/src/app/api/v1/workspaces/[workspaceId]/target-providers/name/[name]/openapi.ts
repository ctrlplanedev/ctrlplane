import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/workspaces/{workspaceId}/target-providers/name/{name}": {
      get: {
        summary: "Upserts a target provider.",
        operationId: "upsertTargetProvider",
        parameters: [
          {
            name: "workspaceId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "Name of the workspace",
          },
          {
            name: "name",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "Name of the target provider",
          },
        ],
        responses: {
          "200": {
            description:
              "Successfully retrieved or created the target provider",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                    },
                    name: {
                      type: "string",
                    },
                    workspaceId: {
                      type: "string",
                    },
                  },
                  required: ["id", "name", "workspaceId"],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
          "403": {
            description: "Permission denied",
          },
          "404": {
            description: "Workspace not found",
          },
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
  },
};
