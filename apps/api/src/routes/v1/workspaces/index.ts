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
import { jobAgentsRouter } from "./job-agents.js";
import { jobsRouter } from "./jobs.js";
import { policiesRouter } from "./policies.js";
import { relationshipRulesRouter } from "./relationship-rules.js";
import { releaseTargetsRouter } from "./release-targets.js";
import { releaseRouter } from "./releases.js";
import { resourceProvidersRouter } from "./resource-providers.js";
import { resourceRouter } from "./resources.js";
import { systemRouter } from "./systems.js";
import { workflowTemplatesRouter } from "./workflow-templates.js";

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
    .use("/:workspaceId/resources", resourceRouter)
    .use("/:workspaceId/systems", systemRouter)
    .use("/:workspaceId/resource-providers", resourceProvidersRouter)
    .use("/:workspaceId/deployments", deploymentsRouter)
    .use("/:workspaceId/environments", environmentsRouter)
    .use("/:workspaceId/policies", policiesRouter)
    .use("/:workspaceId/deployment-versions", deploymentVersionsRouter)
    .use("/:workspaceId/jobs", jobsRouter)
    .use("/:workspaceId/relationship-rules", relationshipRulesRouter)
    .use("/:workspaceId/release-targets", releaseTargetsRouter)
    .use("/:workspaceId/releases", releaseRouter)
    .use("/:workspaceId/job-agents", jobAgentsRouter)
    .use("/:workspaceId/workflow-templates", workflowTemplatesRouter);
