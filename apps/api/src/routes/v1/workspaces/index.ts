import { asyncHandler } from "@/types/api.js";
import { Router } from "express";

import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  getWorkspaceBySlug,
  listWorkspaces,
  updateWorkspace,
} from "./handlers.js";

/**
 * Creates the workspaces router
 */
export function createWorkspacesRouter(): Router {
  const router = Router();

  // GET /v1/workspaces - List workspaces
  router.get("/", asyncHandler(listWorkspaces));

  // POST /v1/workspaces - Create workspace
  router.post("/", asyncHandler(createWorkspace));

  // GET /v1/workspaces/slug/:workspaceSlug - Get workspace by slug
  router.get("/slug/:workspaceSlug", asyncHandler(getWorkspaceBySlug));

  // GET /v1/workspaces/:workspaceId - Get workspace
  router.get("/:workspaceId", asyncHandler(getWorkspace));

  // PATCH /v1/workspaces/:workspaceId - Update workspace
  router.patch("/:workspaceId", asyncHandler(updateWorkspace));

  // DELETE /v1/workspaces/:workspaceId - Delete workspace
  router.delete("/:workspaceId", asyncHandler(deleteWorkspace));

  return router;
}
