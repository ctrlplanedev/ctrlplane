import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/job-agents/{agentId}/queue/next": {
      get: {
        summary: "Get the next jobs",
        operationId: "getNextJobs",
        parameters: [
          {
            name: "agentId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "The agent ID",
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jobs: {
                      type: "array",
                      items: {
                        type: "object",
                        $ref: "#/components/schemas/Job",
                      },
                    },
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
