import type { AsyncTypedHandler } from "@/types/api.js";
import { wsEngine } from "@/engine.js";
import { ApiError, NotFoundError } from "@/types/api.js";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { entityRole, user, workspace } from "@ctrlplane/db/schema";
import { predefinedRoles } from "@ctrlplane/validators/auth";

/**
 * GET /v1/workspaces
 * List all workspaces accessible to the authenticated user
 */
export const listWorkspaces: AsyncTypedHandler<
  "/v1/workspaces",
  "get"
> = async (req, res) => {
  const { db, user: currentUser } = req.apiContext!;

  // For admin users, return all workspaces
  // For regular users, return only workspaces they have access to
  const isAdmin = currentUser.systemRole === "admin";

  const workspaces = isAdmin
    ? await db.select().from(workspace)
    : await db
        .select({ workspace })
        .from(workspace)
        .innerJoin(entityRole, eq(workspace.id, entityRole.scopeId))
        .where(
          and(
            eq(entityRole.entityId, currentUser.id),
            eq(entityRole.entityType, "user"),
            eq(entityRole.scopeType, "workspace"),
          ),
        )
        .then((rows) => rows.map((r) => r.workspace));

  res.status(200).json({
    workspaces,
    total: workspaces.length,
  });
};

/**
 * POST /v1/workspaces
 * Create a new workspace and assign the creator as admin
 */
export const createWorkspace: AsyncTypedHandler<
  "/v1/workspaces",
  "post"
> = async (req, res) => {
  const { db, user: currentUser } = req.apiContext!;
  const { name, slug } = req.body;

  try {
    // Create workspace and assign creator as admin in a transaction
    const newWorkspace = await db.transaction(async (tx) => {
      // Create the workspace
      const w = await tx
        .insert(workspace)
        .values({ name, slug })
        .returning()
        .then(takeFirst);

      // Assign creator as admin
      await tx.insert(entityRole).values({
        roleId: predefinedRoles.admin.id,
        scopeType: "workspace",
        scopeId: w.id,
        entityType: "user",
        entityId: currentUser.id,
      });

      // Update user's active workspace
      await tx
        .update(user)
        .set({ activeWorkspaceId: w.id })
        .where(eq(user.id, currentUser.id));

      return w;
    });

    res.status(201).json(newWorkspace);
  } catch (error: any) {
    // Handle unique constraint violation (duplicate slug)
    if (
      error.code === "23505" ||
      error.constraint === "workspace_slug_unique"
    ) {
      throw new ApiError(
        "Workspace slug already exists",
        409,
        "DUPLICATE_SLUG",
      );
    }
    throw error;
  }
};

/**
 * GET /v1/workspaces/:workspaceId
 * Get a specific workspace by ID
 */
export const getWorkspace: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}",
  "get"
> = async (req, res) => {
  const { db, user: currentUser } = req.apiContext!;
  const { workspaceId } = req.params;

  // Check if user is admin or has access to workspace
  const isAdmin = currentUser.systemRole === "admin";

  const result = isAdmin
    ? await db
        .select()
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .limit(1)
        .then(takeFirstOrNull)
    : await db
        .select({ workspace })
        .from(workspace)
        .innerJoin(entityRole, eq(workspace.id, entityRole.scopeId))
        .where(
          and(
            eq(workspace.id, workspaceId),
            eq(entityRole.entityId, currentUser.id),
            eq(entityRole.entityType, "user"),
            eq(entityRole.scopeType, "workspace"),
          ),
        )
        .limit(1)
        .then(takeFirstOrNull)
        .then((row) => row?.workspace ?? null);

  if (!result) {
    throw new NotFoundError("Workspace not found");
  }

  res.status(200).json(result);
};

/**
 * PATCH /v1/workspaces/:workspaceId
 * Update workspace properties
 */
export const updateWorkspace: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}",
  "patch"
> = async (req, res) => {
  const { db, user: currentUser } = req.apiContext!;
  const { workspaceId } = req.params;
  const updates = req.body;

  // First check if workspace exists and user has access
  const isAdmin = currentUser.systemRole === "admin";

  const hasAccess = isAdmin
    ? await db
        .select()
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .limit(1)
        .then((rows) => rows.length > 0)
    : await db
        .select()
        .from(entityRole)
        .where(
          and(
            eq(entityRole.scopeId, workspaceId),
            eq(entityRole.scopeType, "workspace"),
            eq(entityRole.entityId, currentUser.id),
            eq(entityRole.entityType, "user"),
          ),
        )
        .limit(1)
        .then((rows) => rows.length > 0);

  if (!hasAccess) {
    throw new NotFoundError("Workspace not found");
  }

  try {
    const updated = await db
      .update(workspace)
      .set(updates)
      .where(eq(workspace.id, workspaceId))
      .returning()
      .then(takeFirst);

    res.status(200).json(updated);
  } catch (error: any) {
    // Handle unique constraint violation (duplicate slug)
    if (
      error.code === "23505" ||
      error.constraint === "workspace_slug_unique"
    ) {
      throw new ApiError(
        "Workspace slug already exists",
        409,
        "DUPLICATE_SLUG",
      );
    }
    throw error;
  }
};

/**
 * GET /v1/workspaces/slug/:workspaceSlug
 * Get a specific workspace by slug
 */
export const getWorkspaceBySlug: AsyncTypedHandler<
  "/v1/workspaces/slug/{workspaceSlug}",
  "get"
> = async (req, res) => {
  const { db, user: currentUser } = req.apiContext!;
  const { workspaceSlug } = req.params;

  // Check if user is admin or has access to workspace
  const isAdmin = currentUser.systemRole === "admin";

  const result = isAdmin
    ? await db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, workspaceSlug))
        .limit(1)
        .then(takeFirstOrNull)
    : await db
        .select({ workspace })
        .from(workspace)
        .innerJoin(entityRole, eq(workspace.id, entityRole.scopeId))
        .where(
          and(
            eq(workspace.slug, workspaceSlug),
            eq(entityRole.entityId, currentUser.id),
            eq(entityRole.entityType, "user"),
            eq(entityRole.scopeType, "workspace"),
          ),
        )
        .limit(1)
        .then(takeFirstOrNull)
        .then((row) => row?.workspace ?? null);

  if (!result) {
    throw new NotFoundError("Workspace not found");
  }

  res.status(200).json(result);
};

/**
 * DELETE /v1/workspaces/:workspaceId
 * Delete a workspace and all associated data
 */
export const deleteWorkspace: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}",
  "delete"
> = async (req, res) => {
  const { db, user: currentUser } = req.apiContext!;
  const { workspaceId } = req.params;

  // First check if workspace exists and user has access
  const isAdmin = currentUser.systemRole === "admin";

  const hasAccess = isAdmin
    ? await db
        .select()
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .limit(1)
        .then((rows) => rows.length > 0)
    : await db
        .select()
        .from(entityRole)
        .where(
          and(
            eq(entityRole.scopeId, workspaceId),
            eq(entityRole.scopeType, "workspace"),
            eq(entityRole.entityId, currentUser.id),
            eq(entityRole.entityType, "user"),
          ),
        )
        .limit(1)
        .then((rows) => rows.length > 0);

  if (!hasAccess) {
    throw new NotFoundError("Workspace not found");
  }

  // Delete workspace (cascade will handle related records)
  await db.delete(workspace).where(eq(workspace.id, workspaceId));

  res.status(204).send();
};

export const listResources: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset, cel } = req.query;

  console.log("Listing resources for workspace", req.params, req.query);

  const result = await wsEngine.POST(
    "/v1/workspaces/{workspaceId}/resources/query",
    {
      body: {
        filter: cel != null ? { cel } : undefined,
      },
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (result.error?.error) {
    res.status(500).json({ error: result.error.error });
    return;
  }

  res.status(200).json(result.data);
};
