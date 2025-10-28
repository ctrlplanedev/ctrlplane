import { asyncHandler } from "@/types/api.js";
import { Router } from "express";

import {
  deploymentVersionIdRouter,
  deploymentVersionsRouter,
} from "./deployment-versions.js";
import { deploymentsRouter } from "./deployments.js";
import { environmentsRouter } from "./environments.js";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  getWorkspaceBySlug,
  listWorkspaces,
  updateWorkspace,
} from "./handlers.js";
import { jobsRouter } from "./jobs.js";
import { policiesRouter } from "./policies.js";
import { resourceProvidersRouter } from "./resource-providers.js";
import { listResources } from "./resources.js";
import { systemRouter } from "./systems.js";

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
    .use("/:workspaceId/systems", systemRouter)
    .use("/:workspaceId/resource-providers", resourceProvidersRouter)
    .use("/:workspaceId/deployments", deploymentsRouter)
    .use("/:workspaceId/environments", environmentsRouter)
    .use("/:workspaceId/policies", policiesRouter)
    .use("/:workspaceId/deploymentversions", deploymentVersionsRouter)
    .use(
      "/:workspaceId/deploymentversions/:deploymentVersionId",
      deploymentVersionIdRouter,
    )
    .use("/:workspaceId/jobs", jobsRouter);
