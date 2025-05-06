import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  components: {
    schemas: {
      UpdateResourceRelationshipRule: {
        type: "object",
        properties: {
          name: { type: "string" },
          reference: { type: "string" },
          dependencyType: {
            $ref: "#/components/schemas/ResourceRelationshipRuleDependencyType",
          },
          dependencyDescription: { type: "string" },
          description: { type: "string" },
          sourceKind: { type: "string" },
          sourceVersion: { type: "string" },
          targetKind: { type: "string" },
          targetVersion: { type: "string" },
          metadataKeysMatch: {
            type: "array",
            items: { type: "string" },
          },
          metadataTargetKeysEquals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string" },
                value: { type: "string" },
              },
              required: ["key", "value"],
            },
          },
        },
      },
    },
  },
  paths: {
    "/v1/resource-relationship-rules/{ruleId}": {
      patch: {
        summary: "Update a resource relationship rule",
        operationId: "updateResourceRelationshipRule",
        parameters: [
          {
            name: "ruleId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UpdateResourceRelationshipRule",
              },
            },
          },
        },
        responses: {
          200: {
            description: "The updated resource relationship rule",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResourceRelationshipRule",
                },
              },
            },
          },
          404: {
            description: "The resource relationship rule was not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                  required: ["error"],
                },
              },
            },
          },
          500: {
            description:
              "An error occurred while updating the resource relationship rule",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { error: { type: "string" } },
                  required: ["error"],
                },
              },
            },
          },
        },
      },
    },
  },
};
