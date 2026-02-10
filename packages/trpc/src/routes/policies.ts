import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

const EvaluationScope = z.object({
  environmentId: z.uuid(),
  versionId: z.uuid(),
});

export const policiesRouter = router({
  evaluate: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        scope: EvaluationScope,
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, scope } = input;
      const result = await getClientFor(workspaceId).POST(
        "/v1/workspaces/{workspaceId}/policies/evaluate",
        {
          params: { path: { workspaceId } },
          body: scope,
        },
      );
      return result.data?.decision;
    }),

  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId } = input;
      const result = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/policies",
        {
          params: {
            path: { workspaceId },
          },
        },
      );

      return result.data;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        policyId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, policyId } = input;

      // Get the policy first to send with the event
      const response = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/policies/{policyId}",
        {
          params: {
            path: { workspaceId, policyId },
          },
        },
      );

      if (!response.data) {
        throw new Error("Policy not found");
      }

      const policy = response.data;

      // Send the delete event - the workspace engine will process it
      await sendGoEvent({
        workspaceId,
        eventType: Event.PolicyDeleted,
        timestamp: Date.now(),
        data: policy,
      });

      return policy;
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        policyId: z.string().uuid(),
        body: z.object({
          name: z.string(),
          description: z.string().optional(),
          enabled: z.boolean(),
          priority: z.number(),
          metadata: z.record(z.string(), z.string()),
          rules: z.array(z.record(z.string(), z.any())),
          selector: z.string(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, policyId, body } = input;
      const client = getClientFor(workspaceId);

      // Check if policy already exists
      const existingPolicy = await client.GET(
        "/v1/workspaces/{workspaceId}/policies/{policyId}",
        { params: { path: { workspaceId, policyId } } },
      );

      const isUpdate = existingPolicy.data != null;

      const policy: WorkspaceEngine["schemas"]["Policy"] = {
        id: policyId,
        workspaceId,
        createdAt: existingPolicy.data?.createdAt ?? new Date().toISOString(),
        name: body.name,
        description: body.description,
        priority: body.priority,
        enabled: body.enabled,
        metadata: body.metadata,
        rules:
          body.rules as unknown as WorkspaceEngine["schemas"]["PolicyRule"][],
        selector: body.selector,
      };

      await sendGoEvent({
        workspaceId,
        eventType: isUpdate ? Event.PolicyUpdated : Event.PolicyCreated,
        timestamp: Date.now(),
        data: policy,
      });

      return { id: policyId, message: "Policy update requested" };
    }),

  releaseTargets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        policyId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, policyId } = input;
      const resp = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/policies/{policyId}/release-targets",
        {
          params: {
            path: { workspaceId, policyId },
          },
        },
      );

      if (resp.error != null)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            resp.error.error ?? "Failed to get release targets for policy",
        });

      return resp.data.releaseTargets ?? [];
    }),
});
