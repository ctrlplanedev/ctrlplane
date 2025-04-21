import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },

  paths: {
    "/v1/policies/{policyId}": {
      delete: {
        summary: "Delete a policy",
        operationId: "deletePolicy",
        parameters: [
          {
            name: "policyId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
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
                    count: { type: "number" },
                  },
                },
              },
            },
          },
          500: {
            description: "Internal Server Error",
          },
        },
      },
    },
  },
};
