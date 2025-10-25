import { Router } from "express";

import { createWorkspacesRouter } from "./v1/workspaces/index.js";

/**
 * Creates and configures the v1 API router
 */
export const createV1Router = (): Router =>
  Router().use("/workspaces", createWorkspacesRouter());
