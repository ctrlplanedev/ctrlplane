import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const policySkipsRouter = router({
  forEnvAndVersion: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        environmentId: z.string(),
        versionId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, environmentId, versionId } = input;
      const deploymentVersionId = versionId;
      const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/policy-skips/environment/{environmentId}/version/{deploymentVersionId}",
        {
          params: { path: { workspaceId, environmentId, deploymentVersionId } },
        },
      );
      return result.data?.items ?? [];
    }),

  createForEnvAndVersion: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        environmentId: z.string(),
        versionId: z.string(),
        ruleId: z.string(),
        expiresAt: z.date().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, environmentId, versionId, ruleId, expiresAt } =
        input;
      const userId = ctx.session.user.id;

      await sendGoEvent({
        workspaceId,
        eventType: Event.PolicySkipCreated,
        timestamp: Date.now(),
        data: {
          id: uuidv4(),
          workspaceId,
          versionId,
          environmentId,
          ruleId,
          expiresAt: expiresAt?.toISOString(),
          createdAt: new Date().toISOString(),
          createdBy: userId,
          reason: "Skipped by user",
        },
      });
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        skipId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, skipId } = input;
      const skip = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/policy-skips/{policySkipId}",
        {
          params: { path: { workspaceId, policySkipId: skipId } },
        },
      );
      if (skip.error != null)
        throw new TRPCError({ code: "NOT_FOUND", message: "Skip not found" });
      await sendGoEvent({
        workspaceId,
        eventType: Event.PolicySkipDeleted,
        timestamp: Date.now(),
        data: skip.data,
      });
      return skip.data;
    }),
});
