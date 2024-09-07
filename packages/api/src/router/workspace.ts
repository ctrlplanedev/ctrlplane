import { TRPCError } from "@trpc/server";
import { addWeeks } from "date-fns";
import { auth } from "google-auth-library";
import { google } from "googleapis";
import { z } from "zod";

import { and, eq, isNull, or, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  createWorkspace,
  entityRole,
  role,
  updateWorkspace,
  user,
  workspace,
  workspaceInviteToken,
} from "@ctrlplane/db/schema";
import { predefinedRoles } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const membersRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(entityRole)
        .innerJoin(workspace, eq(workspace.id, entityRole.scopeId))
        .innerJoin(role, eq(entityRole.roleId, role.id))
        .innerJoin(user, eq(entityRole.entityId, user.id))
        .where(
          and(
            eq(entityRole.scopeId, input),
            eq(entityRole.scopeType, "workspace"),
          ),
        )
        .then((members) =>
          members.map((m) => ({
            id: m.entity_role.id,
            user: m.user,
            role: m.role,
            workspace: m.workspace,
          })),
        ),
    ),
});

const integrationsRouter = createTRPCRouter({
  google: createTRPCRouter({
    createServiceAccount: protectedProcedure
      .input(z.string().uuid())
      .mutation(async ({ ctx, input }) => {
        const ws = await ctx.db
          .select()
          .from(workspace)
          .where(eq(workspace.id, input))
          .then(takeFirstOrNull);

        if (ws == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });

        if (ws.googleServiceAccountEmail !== null)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Google service account already exists.",
          });

        const projectId = await auth.getProjectId();

        const sa = await google.iam("v1").projects.serviceAccounts.create({
          name: `projects/${projectId}`,
          auth,
          requestBody: {
            accountId: `ctrlplane-${ws.slug}`,
            serviceAccount: {
              displayName: `Workspace ${ws.slug}`,
              description: `Service account for ${ws.slug} (${ws.id})`,
            },
          },
        });

        if (sa.data.email == null)
          throw new Error("No email server account response");

        return ctx.db
          .update(workspace)
          .set({
            googleServiceAccountEmail: sa.data.email,
          })
          .where(eq(workspace.id, input))
          .returning()
          .then(takeFirst);
      }),
  }),
});

const inviteRouter = createTRPCRouter({
  token: createTRPCRouter({
    accept: protectedProcedure
      .input(z.string().uuid())
      .mutation(async ({ ctx, input: inviteToken }) =>
        ctx.db.transaction(async (tx) => {
          const invite = await tx
            .select()
            .from(workspaceInviteToken)
            .where(eq(workspaceInviteToken.token, inviteToken))
            .then(takeFirst);

          return tx.insert(entityRole).values({
            roleId: invite.roleId,

            scopeType: "workspace",
            scopeId: invite.workspaceId,

            entityType: "user",
            entityId: ctx.session.user.id,
          });
        }),
      ),

    create: protectedProcedure
      .input(
        z.object({
          roleId: z.string().uuid(),
          workspaceId: z.string().uuid(),
          token: z.string().uuid(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        ctx.db
          .insert(workspaceInviteToken)
          .values({
            ...input,
            createdBy: ctx.session.user.id,
            expiresAt: addWeeks(new Date(), 1),
          })
          .returning()
          .then(takeFirst),
      ),
  }),
});

export const workspaceRouter = createTRPCRouter({
  invite: inviteRouter,
  members: membersRouter,
  integrations: integrationsRouter,

  roles: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(role)
        .where(or(eq(role.workspaceId, input), isNull(role.workspaceId))),
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateWorkspace }))
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(workspace)
        .set(input.data)
        .where(eq(workspace.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  create: protectedProcedure
    .input(createWorkspace)
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const w = await tx
          .insert(workspace)
          .values(input)
          .returning()
          .then(takeFirst);

        await tx.insert(entityRole).values({
          roleId: predefinedRoles.admin.id,

          scopeType: "workspace",
          scopeId: w.id,

          entityType: "user",
          entityId: ctx.session.user.id,
        });

        return w;
      }),
    ),

  list: protectedProcedure.query(async ({ ctx }) =>
    ctx.db
      .select()
      .from(workspace)
      .innerJoin(entityRole, eq(workspace.id, entityRole.scopeId))
      .where(eq(entityRole.entityId, ctx.session.user.id))
      .then((rows) => rows.map((r) => r.workspace)),
  ),

  bySlug: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, input))
        .then(takeFirstOrNull),
    ),

  byId: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.id, input))
        .then(takeFirstOrNull),
    ),
});
