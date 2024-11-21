import type { Swagger } from "atlassian-openapi";

export const openapi: Swagger.SwaggerV3 = {
  openapi: "3.0.0",
  info: {
    title: "Ctrlplane API",
    version: "1.0.0",
  },
  paths: {
    "/v1/systems/{systemId}/environments/{name}": {
      delete: {
        summary: "Delete an environment",
        operationId: "deleteEnvironmentByName",
        parameters: [
          {
            name: "systemId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "UUID of the system",
          },
          {
            name: "name",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Name of the environment",
          },
        ],
        responses: {
          "200": {
            description: "Environment deleted successfully",
          },
        },
      },
    },
  },
};
