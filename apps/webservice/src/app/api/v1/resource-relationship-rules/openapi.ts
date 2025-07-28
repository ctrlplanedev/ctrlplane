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
        operationId: "createResourceRelationshipRule",
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
          "409": {
            description: "Resource relationship rule already exists",
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
          "500": {
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
      },

      MetadataEqualsConstraint: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
        },
      },

      MetadataKeyMatchConstraint: {
        type: "object",
        properties: {
          sourceKey: { type: "string" },
          targetKey: { type: "string" },
        },
        required: ["sourceKey", "targetKey"],
      },

      ResourceRelationshipRule: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          workspaceId: { type: "string", format: "uuid" },
          name: { type: "string" },
          reference: { type: "string" },
          dependencyType: {
            $ref: "#/components/schemas/ResourceRelationshipRuleDependencyType",
          },
          dependencyDescription: { type: "string" },
          description: { type: "string" },

          sourceKind: { type: "string" },
          sourceVersion: { type: "string" },
          sourceMetadataEquals: {
            type: "array",
            items: { $ref: "#/components/schemas/MetadataEqualsConstraint" },
          },

          targetKind: { type: "string" },
          targetVersion: { type: "string" },
          targetMetadataEquals: {
            type: "array",
            items: { $ref: "#/components/schemas/MetadataEqualsConstraint" },
          },

          metadataKeysMatches: {
            type: "array",
            items: { $ref: "#/components/schemas/MetadataKeyMatchConstraint" },
          },
        },
        required: [
          "id",
          "workspaceId",
          "name",
          "reference",
          "dependencyType",
          "sourceKind",
          "sourceVersion",
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
          metadataKeysMatches: {
            type: "array",
            items: { $ref: "#/components/schemas/MetadataKeyMatchConstraint" },
          },
          targetMetadataEquals: {
            type: "array",
            items: { $ref: "#/components/schemas/MetadataEqualsConstraint" },
          },

          sourceMetadataEquals: {
            type: "array",
            items: { $ref: "#/components/schemas/MetadataEqualsConstraint" },
          },
        },
        required: [
          "workspaceId",
          "name",
          "reference",
          "dependencyType",
          "sourceKind",
          "sourceVersion",
        ],
      },
    },
  },
};
