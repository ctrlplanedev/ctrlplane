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
        summary: "Get a job",
        operationId: "getJob",
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
                    status: {
                      type: "string",
                      enum: [
                        "completed",
                        "cancelled",
                        "skipped",
                        "in_progress",
                        "action_required",
                        "pending",
                        "failure",
                        "invalid_job_agent",
                        "invalid_integration",
                        "external_run_not_found",
                      ],
                    },
                    release: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                        },
                        version: {
                          type: "string",
                        },
                        metadata: {
                          type: "object",
                        },
                        config: {
                          type: "object",
                        },
                      },
                      required: ["id", "version", "metadata", "config"],
                    },
                    deployment: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                        },
                        name: {
                          type: "string",
                        },
                        slug: {
                          type: "string",
                        },
                        systemId: {
                          type: "string",
                        },
                        jobAgentId: {
                          type: "string",
                        },
                      },
                      required: [
                        "id",
                        "version",
                        "slug",
                        "systemId",
                        "jobAgentId",
                      ],
                    },
                    runbook: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                        },
                        name: {
                          type: "string",
                        },
                        systemId: {
                          type: "string",
                        },
                        jobAgentId: {
                          type: "string",
                        },
                      },
                      required: ["id", "name", "systemId", "jobAgentId"],
                    },
                    target: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                        },
                        name: {
                          type: "string",
                        },
                        version: {
                          type: "string",
                        },
                        kind: {
                          type: "string",
                        },
                        identifier: {
                          type: "string",
                        },
                        workspaceId: {
                          type: "string",
                        },
                        config: {
                          type: "object",
                        },
                        metadata: {
                          type: "object",
                        },
                      },
                      required: [
                        "id",
                        "name",
                        "version",
                        "kind",
                        "identifier",
                        "workspaceId",
                        "config",
                        "metadata",
                      ],
                    },
                    environment: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                        },
                        name: {
                          type: "string",
                        },
                        systemId: {
                          type: "string",
                        },
                      },
                      required: ["id", "name", "systemId"],
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
                    createdAt: {
                      type: "string",
                      format: "date-time",
                    },
                    updatedAt: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                  required: [
                    "id",
                    "status",
                    "createdAt",
                    "updatedAt",
                    "variables",
                  ],
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
