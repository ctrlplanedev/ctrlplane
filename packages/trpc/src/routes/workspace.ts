import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { desc, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";
import { Permission, predefinedRoles } from "@ctrlplane/validators/auth";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const workspaceRouter = router({
  engineStatus: protectedProcedure
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ input }) => {
      const response = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/status",
        {
          params: {
            path: {
              workspaceId: input.workspaceId,
            },
          },
        },
      );

      return response.data ?? { healthy: false, message: "Engine not found" };
    }),

  saveHistory: protectedProcedure
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const snapshots = await ctx.db
        .select()
        .from(schema.workspace)
        .innerJoin(
          schema.workspaceSnapshot,
          eq(schema.workspace.id, schema.workspaceSnapshot.workspaceId),
        )
        .where(eq(schema.workspace.id, input.workspaceId))
        .limit(500)
        .orderBy(desc(schema.workspaceSnapshot.timestamp));

      return snapshots;
    }),

  save: protectedProcedure
    .input(z.object({ workspaceId: z.uuid() }))
    .mutation(async ({ input }) => {
      await sendGoEvent({
        workspaceId: input.workspaceId,
        eventType: Event.WorkspaceSave,
        timestamp: Date.now(),
        data: {},
      });
      return true;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(3, {
            message: "Workspace name must be at least 3 characters long.",
          })
          .max(30, {
            message: "Workspace name must be at most 30 characters long.",
          }),
        slug: z
          .string()
          .min(3, {
            message: "Workspace slug must be at least 3 characters long.",
          })
          .max(50, {
            message: "Workspace slug must be at most 50 characters long.",
          })
          .regex(/^[a-z0-9-]+$/, {
            message:
              "Workspace slug can only contain lowercase letters, numbers, and hyphens",
          }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if slug is already taken
      const slugExists = await ctx.db
        .select()
        .from(schema.workspace)
        .where(eq(schema.workspace.slug, input.slug))
        .then(takeFirstOrNull);

      if (slugExists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This workspace slug is already taken",
        });
      }

      // Create workspace and assign creator as admin in a transaction
      const newWorkspace = await ctx.db.transaction(async (tx) => {
        // Create the workspace
        const workspace = await tx
          .insert(schema.workspace)
          .values({
            name: input.name,
            slug: input.slug,
          })
          .returning()
          .then(takeFirst);

        // Assign creator as admin
        await tx.insert(schema.entityRole).values({
          roleId: predefinedRoles.admin.id,
          scopeType: "workspace",
          scopeId: workspace.id,
          entityType: "user",
          entityId: ctx.session.user.id,
        });

        // Update user's active workspace
        await tx
          .update(schema.user)
          .set({ activeWorkspaceId: workspace.id })
          .where(eq(schema.user.id, ctx.session.user.id));

        return workspace;
      });

      // Trigger workspace engine to save initial snapshot
      // await sendGoEvent({
      //   workspaceId: newWorkspace.id,
      //   eventType: Event.WorkspaceSave,
      //   timestamp: Date.now(),
      //   data: {},
      // });

      return newWorkspace;
    }),

  get: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.WorkspaceGet)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.db
        .select()
        .from(schema.workspace)
        .where(eq(schema.workspace.id, input.workspaceId))
        .then(takeFirstOrNull);

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      return workspace;
    }),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.WorkspaceUpdate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.uuid(),
        data: z.object({
          name: z
            .string()
            .min(3, {
              message: "Workspace name must be at least 3 characters long.",
            })
            .max(100, {
              message: "Workspace name must be at most 100 characters long.",
            })
            .optional(),
          slug: z
            .string()
            .min(3, {
              message: "Workspace slug must be at least 3 characters long.",
            })
            .max(50, {
              message: "Workspace slug must be at most 50 characters long.",
            })
            .regex(/^[a-z0-9-]+$/, {
              message:
                "Workspace slug can only contain lowercase letters, numbers, and hyphens",
            })
            .optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, data } = input;

      // Check if workspace exists
      const existingWorkspace = await ctx.db
        .select()
        .from(schema.workspace)
        .where(eq(schema.workspace.id, workspaceId))
        .then(takeFirstOrNull);

      if (!existingWorkspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      // If slug is being updated, check if it's already taken by another workspace
      if (data.slug && data.slug !== existingWorkspace.slug) {
        const slugExists = await ctx.db
          .select()
          .from(schema.workspace)
          .where(eq(schema.workspace.slug, data.slug))
          .then(takeFirstOrNull);

        if (slugExists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This workspace slug is already taken",
          });
        }
      }

      // Update the workspace
      const updatedWorkspace = await ctx.db
        .update(schema.workspace)
        .set({
          ...data,
        })
        .where(eq(schema.workspace.id, workspaceId))
        .returning()
        .then(takeFirst);

      return updatedWorkspace;
    }),

  invite: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, email } = input;
      const targetUser = await ctx.db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, email))
        .then(takeFirst);

      await ctx.db.insert(schema.entityRole).values({
        roleId: predefinedRoles.admin.id,
        scopeType: "workspace",
        scopeId: workspaceId,
        entityType: "user",
        entityId: targetUser.id,
      });

      return { success: true };
    }),
});
