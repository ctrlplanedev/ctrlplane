import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/policies/{policyId}/release-targets": {
      get: {
        summary: "Get release targets for a policy",
        operationId: "getReleaseTargetsForPolicy",
        parameters: [
          {
            name: "policyId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "UUID of the policy",
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
                    releaseTargets: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          description: { type: "string" },
                          policyTarget: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              name: { type: "string" },
                              policyId: { type: "string" },
                              description: { type: "string" },
                            },
                          },
                          resource: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              name: { type: "string" },
                              identifier: { type: "string" },
                              kind: { type: "string" },
                              version: { type: "string" },
                            },
                          },
                          environment: {
                            type: "object",
                            properties: {
                              id: { type: "string" },
                              name: { type: "string" },
                            },
                          },
                        },
                      },
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
