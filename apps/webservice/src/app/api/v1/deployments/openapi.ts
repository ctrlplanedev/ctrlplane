import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/deployments": {
      post: {
        summary: "Create a deployment",
        operationId: "createDeployment",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  systemId: {
                    type: "string",
                    format: "uuid",
                    description:
                      "The ID of the system to create the deployment for",
                    example: "123e4567-e89b-12d3-a456-426614174000",
                  },
                  name: {
                    type: "string",
                    description: "The name of the deployment",
                    example: "My Deployment",
                  },
                  slug: {
                    type: "string",
                    description: "The slug of the deployment",
                    example: "my-deployment",
                  },
                  description: {
                    type: "string",
                    description: "The description of the deployment",
                    example: "This is a deployment for my system",
                  },
                  jobAgentId: {
                    type: "string",
                    format: "uuid",
                    description:
                      "The ID of the job agent to use for the deployment",
                    example: "123e4567-e89b-12d3-a456-426614174000",
                  },
                  jobAgentConfig: {
                    type: "object",
                    description: "The configuration for the job agent",
                    example: { key: "value" },
                  },
                  retryCount: {
                    type: "number",
                    description: "The number of times to retry the deployment",
                    example: 3,
                  },
                  timeout: {
                    type: "number",
                    description: "The timeout for the deployment",
                    example: 60,
                  },
                  resourceFilter: {
                    type: "object",
                    description: "The resource filter for the deployment",
                    example: { key: "value" },
                  },
                },
                required: ["systemId", "slug", "name"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Deployment created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Deployment" },
              },
            },
          },
          "409": {
            description: "Deployment already exists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    id: { type: "string", format: "uuid" },
                  },
                  required: ["error", "id"],
                },
              },
            },
          },
          "500": {
            description: "Failed to create deployment",
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
      get: {
        summary: "List all deployments",
        operationId: "listDeployments",
        responses: {
          "200": {
            description: "All deployments",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Deployment" },
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
