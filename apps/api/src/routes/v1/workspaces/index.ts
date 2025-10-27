import { asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { deploymentVersionsRouter } from "./deployment-versions.js";
import { deploymentsRouter } from "./deployments.js";
import { environmentsRouter } from "./environments.js";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  getWorkspaceBySlug,
  listResources,
  listWorkspaces,
  updateWorkspace,
} from "./handlers.js";
import { policiesRouter } from "./policies.js";
import { setResourceProviderResources } from "./resource-provider.js";

/**
 * Creates the workspaces router
 */
export const createWorkspacesRouter = (): Router =>
  Router()
    .get("/", asyncHandler(listWorkspaces))
    .post("/", asyncHandler(createWorkspace))
    .get("/slug/:workspaceSlug", asyncHandler(getWorkspaceBySlug))
    .get("/:workspaceId", asyncHandler(getWorkspace))
    .patch("/:workspaceId", asyncHandler(updateWorkspace))
    .delete("/:workspaceId", asyncHandler(deleteWorkspace))
    .get("/:workspaceId/resources", asyncHandler(listResources))
    .post(
      "/:workspaceId/resource-providers/:providerId/set",
      asyncHandler(setResourceProviderResources),
    )
    .use("/:workspaceId/deployments", deploymentsRouter)
    .use("/:workspaceId/environments", environmentsRouter)
    .use("/:workspaceId/policies", policiesRouter)
    .use("/:workspaceId/deploymentversions", deploymentVersionsRouter);
