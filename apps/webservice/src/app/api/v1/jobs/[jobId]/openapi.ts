import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/jobs/{jobId}": {
      get: {
        summary: "Get a Job",
        operationId: "getJob",
        parameters: [
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "The job ID",
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/Job" },
                    {
                      type: "object",
                      properties: {
                        release: { $ref: "#/components/schemas/Release" },
                        deployment: { $ref: "#/components/schemas/Deployment" },
                        runbook: { $ref: "#/components/schemas/Runbook" },
                        resource: { $ref: "#/components/schemas/Resource" },
                        environment: {
                          $ref: "#/components/schemas/Environment",
                        },
                        variables: {
                          type: "object",
                        },
                        approval: {
                          type: "object",
                          nullable: true,
                          properties: {
                            id: {
                              type: "string",
                            },
                            status: {
                              type: "string",
                              enum: ["pending", "approved", "rejected"],
                            },
                            approver: {
                              type: "object",
                              nullable: true,
                              description:
                                "Null when status is pending, contains approver details when approved or rejected",
                              properties: {
                                id: {
                                  type: "string",
                                },
                                name: {
                                  type: "string",
                                },
                              },
                              required: ["id", "name"],
                            },
                          },
                          required: ["id", "status"],
                        },
                      },
                      required: ["variables"],
                    },
                  ],
                },
              },
            },
          },
          "404": {
            description: "Not Found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Job not found.",
                    },
                  },
                },
              },
            },
          },
        },
      },
      patch: {
        summary: "Update a job",
        operationId: "updateJob",
        parameters: [
          {
            name: "jobId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "The execution ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                  },
                  message: {
                    type: "string",
                    nullable: true,
                  },
                  externalId: {
                    type: "string",
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                    },
                  },
                  required: ["id"],
                },
              },
            },
          },
        },
      },
    },
  },
};
