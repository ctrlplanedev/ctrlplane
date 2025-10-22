import { Router } from "express";

import { createWorkspacesRouter } from "./v1/workspaces/index.js";

/**
 * Creates and configures the v1 API router
 */
export function createV1Router(): Router {
  const router = Router();

  // Mount workspace routes
  router.use("/workspaces", createWorkspacesRouter());

  return router;
}
