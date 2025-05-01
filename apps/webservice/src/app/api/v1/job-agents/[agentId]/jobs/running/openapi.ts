import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/job-agents/{agentId}/jobs/running": {
      get: {
        summary: "Get a agents running jobs",
        operationId: "getAgentRunningJobs",
        parameters: [
          {
            name: "agentId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "The execution ID",
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
                      items: { $ref: "#/components/schemas/Job" },
                    },
                  },
                  required: ["jobs"],
                },
              },
            },
          },
        },
      },
    },
  },
};
