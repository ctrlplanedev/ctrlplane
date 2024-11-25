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
                  jobId: { type: "string", format: "uuid" },
                  resourceIdentifier: { type: "string" },
                },
                required: ["jobId", "resourceIdentifier"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Relationship created" },
          "400": { description: "Invalid request body" },
          "404": { description: "Job or resource not found" },
          "409": { description: "Relationship already exists" },
          "500": { description: "Internal server error" },
        },
      },
    },
  },
};
