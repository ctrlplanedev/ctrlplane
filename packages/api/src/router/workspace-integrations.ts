import { TRPCError } from "@trpc/server";
import { auth } from "google-auth-library";
import { google } from "googleapis";
import { z } from "zod";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { workspace, workspaceGoogleIntegration } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const integrationsRouter = createTRPCRouter({
  google: createTRPCRouter({
    createServiceAccount: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceUpdate)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          projectId: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const ws = await ctx.db
          .select()
          .from(workspace)
          .where(eq(workspace.id, input.workspaceId))
          .then(takeFirstOrNull);

        if (ws == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });

        const existingIntegration = await ctx.db
          .select()
          .from(workspaceGoogleIntegration)
          .where(
            and(
              eq(workspaceGoogleIntegration.workspaceId, input.workspaceId),
              eq(workspaceGoogleIntegration.projectId, input.projectId),
            ),
          )
          .then(takeFirstOrNull);

        if (existingIntegration)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Google service account already exists for this workspace and project.",
          });

        const accountIdBase = `ctrlplane-${ws.slug}`;
        const accountId = accountIdBase
          .slice(0, 30)
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-");

        const sa = await google.iam("v1").projects.serviceAccounts.create({
          name: `projects/${input.projectId}`,
          auth,
          requestBody: {
            accountId: accountId,
            serviceAccount: {
              displayName: `Workspace ${ws.slug} - ${input.projectId}`,
              description: `Service account for ${ws.slug} (${ws.id}) in project ${input.projectId}`,
            },
          },
        });

        if (sa.data.email == null)
          throw new Error("No email server account response");

        return ctx.db
          .insert(workspaceGoogleIntegration)
          .values({
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            serviceAccountEmail: sa.data.email,
          })
          .returning()
          .then(takeFirst);
      }),

    deleteServiceAccount: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceUpdate)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          projectId: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const integration = await ctx.db
          .select()
          .from(workspaceGoogleIntegration)
          .where(
            and(
              eq(workspaceGoogleIntegration.workspaceId, input.workspaceId),
              eq(workspaceGoogleIntegration.projectId, input.projectId),
            ),
          )
          .then(takeFirstOrNull);

        if (integration == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Google service account does not exist for this workspace and project.",
          });

        await google.iam("v1").projects.serviceAccounts.delete({
          name: `projects/${input.projectId}/serviceAccounts/${integration.serviceAccountEmail}`,
          auth,
        });

        return ctx.db
          .delete(workspaceGoogleIntegration)
          .where(eq(workspaceGoogleIntegration.id, integration.id))
          .returning()
          .then(takeFirst);
      }),

    listIntegrations: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceListIntegrations)
            .on({ type: "workspace", id: input }),
      })
      .input(z.string().uuid())
      .query(async ({ ctx, input }) => {
        return ctx.db
          .select()
          .from(workspaceGoogleIntegration)
          .where(eq(workspaceGoogleIntegration.workspaceId, input));
      }),

    listAvailableProjectIds: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.WorkspaceListIntegrations)
            .on({ type: "workspace", id: input }),
      })
      .input(z.string().uuid())
      .query(async ({ ctx, input }) => {
        const cloudResourceManager = google.cloudresourcemanager("v1");

        const res = await cloudResourceManager.projects.list({
          auth,
          filter: `lifecycleState:ACTIVE`,
        });

        const allProjectIds =
          res.data.projects?.map((project) => project.projectId) ?? [];

        const existingIntegrations = await ctx.db
          .select()
          .from(workspaceGoogleIntegration)
          .where(eq(workspaceGoogleIntegration.workspaceId, input));

        const existingProjectIds = existingIntegrations
          .map((integration) => integration.projectId)
          .filter((id): id is string => id !== "");

        const availableProjectIds = allProjectIds
          .filter((id): id is string => id != null)
          .filter((projectId) => !existingProjectIds.includes(projectId));

        return availableProjectIds;
      }),
  }),
});
