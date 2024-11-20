import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/systems/{systemId}": {
      get: {
        summary: "Get a system",
        parameters: [
          {
            name: "systemId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "UUID of the system",
          },
        ],
        responses: {
          "200": {
            description: "System retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    slug: { type: "string" },
                    description: { type: "string" },
                    workspaceId: { type: "string" },
                    environments: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          description: { type: "string", nullable: true },
                          expiresAt: {
                            type: "string",
                            format: "date-time",
                            nullable: true,
                          },
                          createdAt: { type: "string", format: "date-time" },
                          systemId: { type: "string" },
                          policyId: { type: "string", nullable: true },
                          resourceFilter: {
                            type: "object",
                            additionalProperties: true,
                            nullable: true,
                          },
                        },
                      },
                    },
                    deployments: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          slug: { type: "string" },
                          description: { type: "string" },
                          systemId: { type: "string" },
                          jobAgentId: { type: "string", nullable: true },
                          jobAgentConfig: {
                            type: "object",
                            additionalProperties: true,
                          },
                        },
                      },
                    },
                  },
                  required: [
                    "id",
                    "name",
                    "slug",
                    "description",
                    "workspaceId",
                    "environments",
                    "deployments",
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
};
