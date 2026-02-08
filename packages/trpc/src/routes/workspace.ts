import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, isNull, or, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
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
      await sendGoEvent({
        workspaceId: newWorkspace.id,
        eventType: Event.WorkspaceSave,
        timestamp: Date.now(),
        data: {},
      });

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

  members: protectedProcedure
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { workspaceId } = input;

      const members = await ctx.db
        .select()
        .from(schema.user)
        .innerJoin(
          schema.entityRole,
          eq(schema.user.id, schema.entityRole.entityId),
        )
        .innerJoin(schema.role, eq(schema.entityRole.roleId, schema.role.id))
        .where(eq(schema.entityRole.scopeId, workspaceId));

      return members;
    }),

  roles: protectedProcedure
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(schema.role)
        .where(
          or(
            eq(schema.role.workspaceId, input.workspaceId),
            isNull(schema.role.workspaceId),
          ),
        );
    }),

  domainMatchingList: protectedProcedure
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const rules = await ctx.db
        .select()
        .from(schema.workspaceEmailDomainMatching)
        .innerJoin(
          schema.role,
          eq(schema.workspaceEmailDomainMatching.roleId, schema.role.id),
        )
        .where(
          eq(
            schema.workspaceEmailDomainMatching.workspaceId,
            input.workspaceId,
          ),
        );

      return rules.map((r) => ({
        ...r.workspace_email_domain_matching,
        roleName: r.role.name,
      }));
    }),

  domainMatchingCreate: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        domain: z
          .string()
          .min(1)
          .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
            message: "Invalid domain format",
          }),
        roleId: z.string().min(1),
        verificationEmail: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, domain, roleId, verificationEmail } = input;

      const verificationCode = crypto.randomBytes(16).toString("hex");

      const rule = await ctx.db
        .insert(schema.workspaceEmailDomainMatching)
        .values({
          workspaceId,
          domain: domain.toLowerCase(),
          roleId,
          verificationCode,
          verificationEmail,
        })
        .returning()
        .then(takeFirst);

      return rule;
    }),

  domainMatchingVerify: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        workspaceId: z.uuid(),
        verificationCode: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.db
        .select()
        .from(schema.workspaceEmailDomainMatching)
        .where(
          and(
            eq(schema.workspaceEmailDomainMatching.id, input.id),
            eq(
              schema.workspaceEmailDomainMatching.workspaceId,
              input.workspaceId,
            ),
          ),
        )
        .then(takeFirstOrNull);

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Domain matching rule not found",
        });
      }

      if (rule.verificationCode !== input.verificationCode) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code",
        });
      }

      const updated = await ctx.db
        .update(schema.workspaceEmailDomainMatching)
        .set({ verified: true })
        .where(eq(schema.workspaceEmailDomainMatching.id, input.id))
        .returning()
        .then(takeFirst);

      return updated;
    }),

  domainMatchingDelete: protectedProcedure
    .input(z.object({ id: z.uuid(), workspaceId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(schema.workspaceEmailDomainMatching)
        .where(
          and(
            eq(schema.workspaceEmailDomainMatching.id, input.id),
            eq(
              schema.workspaceEmailDomainMatching.workspaceId,
              input.workspaceId,
            ),
          ),
        );

      return { success: true };
    }),
});
