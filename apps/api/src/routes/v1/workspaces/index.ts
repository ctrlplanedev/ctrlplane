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
  listWorkspaces,
  updateWorkspace,
} from "./handlers.js";
import { jobsRouter } from "./jobs.js";
import { policiesRouter } from "./policies.js";
import { relationshipRulesRouter } from "./relationship-rules.js";
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
    .use("/:workspaceId/deployment-versions", deploymentVersionsRouter)
    .use("/:workspaceId/jobs", jobsRouter)
    .use("/:workspaceId/relationship-rules", relationshipRulesRouter);
