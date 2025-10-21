import type OpenAPIBackend from "openapi-backend";

import * as userHandlers from "./v1/users/index.js";

/**
 * Register all route handlers with OpenAPI Backend
 * Each handler is mapped to its corresponding operationId from the OpenAPI spec
 */
export function registerHandlers(api: OpenAPIBackend) {
  api.register({
    // User routes
    listUsers: userHandlers.listUsers,
    createUser: userHandlers.createUser,
    getUser: userHandlers.getUser,
    updateUser: userHandlers.updateUser,
    deleteUser: userHandlers.deleteUser,

    // Error handlers
    validationFail: async (c, req, res) => {
      res.status(400).json({
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: c.validation.errors,
      });
    },

    notFound: async (c, req, res) => {
      res.status(404).json({
        message: "Route not found",
        code: "NOT_FOUND",
      });
    },

    methodNotAllowed: async (c, req, res) => {
      res.status(405).json({
        message: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
      });
    },

    // Catch-all for unregistered operations
    notImplemented: async (c, req, res) => {
      const { operationId } = c.operation;
      res.status(501).json({
        message: `Operation ${operationId} not implemented`,
        code: "NOT_IMPLEMENTED",
      });
    },
  });

  return api;
}

/**
 * Export all handlers for easy importing
 */
export const handlers = {
  users: userHandlers,
};
