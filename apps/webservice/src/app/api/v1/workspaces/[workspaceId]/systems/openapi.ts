import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/workspaces/:workspaceId/systems": {
      parameters: [
        {
          name: "workspaceId",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
          description: "The ID of the workspace",
        },
      ],
      get: {
        summary: "List all systems",
        operationId: "listSystems",
        responses: {
          "200": {
            description: "All systems",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/System" },
                    }
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
