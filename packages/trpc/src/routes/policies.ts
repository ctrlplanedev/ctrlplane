import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
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

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        priority: z.number().min(0),
        enabled: z.boolean(),
        target: z.object({
          deploymentSelector: z.object({ cel: z.string().min(1) }),
          environmentSelector: z.object({ cel: z.string().min(1) }),
          resourceSelector: z.object({ cel: z.string().min(1) }),
        }),
        anyApproval: z
          .object({
            minApprovals: z.number().min(1),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, target, anyApproval, ...policyInput } = input;
      const policyId = uuidv4();
      const createdAt = new Date().toISOString();
      const selectors: WorkspaceEngine["schemas"]["PolicyTargetSelector"][] = [
        {
          id: uuidv4(),
          deploymentSelector: { cel: target.deploymentSelector.cel },
          environmentSelector: { cel: target.environmentSelector.cel },
          resourceSelector: { cel: target.resourceSelector.cel },
        },
      ];
      const rules: WorkspaceEngine["schemas"]["PolicyRule"][] = [];

      if (anyApproval != null) {
        rules.push({
          id: uuidv4(),
          policyId,
          createdAt,
          anyApproval: {
            minApprovals: anyApproval.minApprovals,
          },
        });
      }

      const policy: WorkspaceEngine["schemas"]["Policy"] = {
        id: policyId,
        workspaceId,
        createdAt,
        name: policyInput.name,
        description: policyInput.description,
        enabled: policyInput.enabled,
        priority: policyInput.priority,
        metadata: {},
        selectors,
        rules,
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.PolicyCreated,
        timestamp: Date.now(),
        data: policy,
      });

      return policy;
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
