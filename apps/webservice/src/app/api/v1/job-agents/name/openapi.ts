import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/job-agents/name": {
      patch: {
        summary: "Upserts the agent",
        operationId: "updateJobAgent",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  workspaceId: {
                    type: "string",
                  },
                  name: {
                    type: "string",
                  },
                  type: {
                    type: "string",
                  },
                },
                required: ["type", "name", "workspaceId"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Successfully retrieved or created the agent",
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
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
  },
};
