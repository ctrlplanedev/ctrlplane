import { asyncHandler } from "@/types/api.js";
import { Router } from "express";

import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  getWorkspaceBySlug,
  listResources,
  listWorkspaces,
  updateWorkspace,
} from "./handlers.js";
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
    );
