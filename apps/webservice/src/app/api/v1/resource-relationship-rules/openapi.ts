import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/resource-relationship-rules": {
      post: {
        summary: "Create a resource relationship rule",
        operationId: "upsertResourceRelationshipRule",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateResourceRelationshipRule",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Resource relationship rule created successfully",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ResourceRelationshipRule",
                },
              },
            },
          },
          "400": {
            description: "Failed to create resource relationship rule",
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
  components: {
    schemas: {
      ResourceRelationshipRuleDependencyType: {
        type: "string",
        enum: [
          "depends_on",
          "depends_indirectly_on",
          "uses_at_runtime",
          "created_after",
          "provisioned_in",
          "inherits_from",
        ],
      },
      ResourceRelationshipRule: {
        type: "object",
        properties: {
          id: { type: "string" },
          workspaceId: { type: "string" },
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
        },
        required: [
          "id",
          "workspaceId",
          "name",
          "reference",
          "dependencyType",
          "sourceKind",
          "sourceVersion",
          "targetKind",
          "targetVersion",
        ],
      },
      CreateResourceRelationshipRule: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
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
        },
        required: [
          "workspaceId",
          "name",
          "reference",
          "dependencyType",
          "sourceKind",
          "sourceVersion",
          "targetKind",
          "targetVersion",
          "metadataKeysMatch",
        ],
      },
    },
  },
};
