import { TRPCError } from "@trpc/server";
import { auth } from "google-auth-library";
import { google } from "googleapis";
import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  targetProvider,
  targetProviderGoogle,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const integrationsRouter = createTRPCRouter({
  google: createTRPCRouter({
    createServiceAccount: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceUpdate)
            .on({ type: "workspace", id: input }),
      })
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

    deleteServiceAccount: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceUpdate)
            .on({ type: "workspace", id: input }),
      })
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

        if (ws.googleServiceAccountEmail == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Google service account does not exist.",
          });

        const existingGoogleProviders = await ctx.db
          .select()
          .from(targetProvider)
          .innerJoin(
            targetProviderGoogle,
            eq(targetProvider.id, targetProviderGoogle.targetProviderId),
          )
          .where(eq(targetProvider.workspaceId, input));

        if (existingGoogleProviders.length > 0)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Cannot delete Google service account while active target providers exist.",
          });

        const projectId = await auth.getProjectId();

        await google.iam("v1").projects.serviceAccounts.delete({
          name: `projects/${projectId}/serviceAccounts/${ws.googleServiceAccountEmail}`,
          auth,
        });

        return ctx.db
          .update(workspace)
          .set({
            googleServiceAccountEmail: null,
          })
          .where(eq(workspace.id, input))
          .returning()
          .then(takeFirst);
      }),
  }),
});
