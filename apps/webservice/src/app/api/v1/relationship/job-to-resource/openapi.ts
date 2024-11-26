import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: { title: "Ctrlplane API", version: "1.0.0" },
  paths: {
    "/v1/relationship/job-to-resource": {
      post: {
        summary: "Create a relationship between a job and a resource",
        operationId: "createJobToResourceRelationship",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  jobId: {
                    type: "string",
                    format: "uuid",
                    description: "Unique identifier of the job",
                    example: "123e4567-e89b-12d3-a456-426614174000",
                  },
                  resourceIdentifier: {
                    type: "string",
                    description: "Unique identifier of the resource",
                    maxLength: 255,
                    example: "resource-123",
                  },
                },
                required: ["jobId", "resourceIdentifier"],
                additionalProperties: false,
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Relationship created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "Relationship created successfully",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Invalid jobId format",
                    },
                  },
                },
              },
            },
          },
          "404": {
            description: "Job or resource not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Job with specified ID not found",
                    },
                  },
                },
              },
            },
          },
          "409": {
            description: "Relationship already exists",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example:
                        "Relationship between job and resource already exists",
                    },
                  },
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
                  properties: {
                    error: {
                      type: "string",
                      example: "Internal server error occurred",
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
