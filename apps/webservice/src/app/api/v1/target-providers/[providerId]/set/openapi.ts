import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/target-providers/{providerId}/set": {
      patch: {
        summary: "Sets the target for a provider.",
        operationId: "setTargetProvidersTargets",
        parameters: [
          {
            name: "providerId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
            description: "UUID of the scanner",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["targets"],
                properties: {
                  targets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        identifier: {
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
                        config: {
                          type: "object",
                        },
                        metadata: {
                          type: "object",
                          additionalProperties: {
                            type: "string",
                          },
                        },
                      },
                      required: [
                        "identifier",
                        "name",
                        "version",
                        "kind",
                        "config",
                        "metadata",
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Successfully updated the deployment target",
          },
          "400": {
            description: "Invalid request",
          },
          "404": {
            description: "Deployment target not found",
          },
          "500": {
            description: "Internal server error",
          },
        },
      },
    },
  },
};
