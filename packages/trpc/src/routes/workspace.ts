import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure, router } from "../trpc.js";

export const workspaceRouter = router({
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

  get: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.WorkspaceGet)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.string().uuid() }))
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
        workspaceId: z.string().uuid(),
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
});
