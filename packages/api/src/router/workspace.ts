import { TRPCError } from "@trpc/server";
import { auth } from "google-auth-library";
import { google } from "googleapis";
import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  createWorkspace,
  user,
  workspace,
  workspaceMember,
} from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const membersRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(workspaceMember)
        .innerJoin(workspace, eq(workspace.id, workspaceMember.workspaceId))
        .innerJoin(user, eq(user.id, workspaceMember.userId))
        .where(eq(workspaceMember.workspaceId, input)),
    ),

  create: protectedProcedure
    .meta({
      access: ({ ctx, input }) => ctx.accessQuery().workspace.id(input),
    })
    .input(z.object({ workspaceId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.insert(workspaceMember).values(input).returning(),
    ),
});

const integrationsRouter = createTRPCRouter({
  google: createTRPCRouter({
    createServiceAccount: protectedProcedure
      .meta({
        access: ({ ctx, input }) => ctx.accessQuery().workspace.id(input),
      })
      .input(z.string())
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

export const workspaceRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createWorkspace)
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction((db) =>
        db
          .insert(workspace)
          .values(input)
          .returning()
          .then(takeFirst)
          .then((w) =>
            db
              .insert(workspaceMember)
              .values({ workspaceId: w.id, userId: ctx.session.user.id })
              .returning(),
          ),
      ),
    ),

  list: protectedProcedure.query(async ({ ctx }) =>
    ctx.db
      .select()
      .from(workspace)
      .innerJoin(workspaceMember, eq(workspace.id, workspaceMember.workspaceId))
      .where(eq(workspaceMember.userId, ctx.session.user.id))
      .then((rows) => rows.map((r) => r.workspace)),
  ),

  bySlug: protectedProcedure
    .meta({
      access: ({ ctx, input }) => ctx.accessQuery().workspace.slug(input),
    })
    .input(z.string())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, input))
        .then(takeFirstOrNull),
    ),

  members: membersRouter,
  integrations: integrationsRouter,
});
