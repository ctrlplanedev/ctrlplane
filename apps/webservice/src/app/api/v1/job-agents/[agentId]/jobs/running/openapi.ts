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
        operationId: "getAgentRunningJob",
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
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                      },
                      status: {
                        type: "string",
                      },
                      message: {
                        type: "string",
                      },
                      jobAgentId: {
                        type: "string",
                      },
                      jobAgentConfig: {
                        type: "object",
                      },
                      externalId: {
                        type: "string",
                        nullable: true,
                      },
                      release: {
                        type: "object",
                      },
                      deployment: {
                        type: "object",
                      },
                      config: {
                        type: "object",
                      },
                      runbook: {
                        type: "object",
                      },
                      target: {
                        type: "object",
                      },
                      environment: {
                        type: "object",
                      },
                    },
                    required: [
                      "id",
                      "status",
                      "message",
                      "jobAgentId",
                      "jobAgentConfig",
                      "externalId",
                      "config",
                    ],
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
