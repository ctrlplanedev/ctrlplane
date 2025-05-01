import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  components: {
    schemas: {
      Event: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          action: { type: "string" },
          payload: { type: "object", additionalProperties: true },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["id", "action", "payload", "createdAt"],
      },
    },
  },
  paths: {
    "/v1/workspaces/{workspaceId}/events/{action}": {
      parameters: [
        {
          name: "workspaceId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "The ID of the workspace",
        },
        {
          name: "action",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      get: {
        summary: "Get events by action",
        operationId: "getEventsByAction",
        responses: {
          "200": {
            description: "Events",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Event" },
                },
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
                  required: ["error"],
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
