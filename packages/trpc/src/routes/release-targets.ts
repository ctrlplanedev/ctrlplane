import { TRPCError } from "@trpc/server";
import z from "zod";

import { and, desc, eq, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const releaseTargetsRouter = router({
  policies: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        releaseTargetKey: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, releaseTargetKey } = input;
      const resp = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/policies",
        {
          params: { path: { workspaceId, releaseTargetKey } },
        },
      );
      if (resp.error != null)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            resp.error.error ?? "Failed to get policies for release target",
        });
      return resp.data.policies ?? [];
    }),

  evaluations: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        resourceId: z.string().uuid(),
        versionId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(schema.policyRuleEvaluation.environmentId, input.environmentId),
        eq(schema.policyRuleEvaluation.resourceId, input.resourceId),
      ];

      if (input.versionId != null) {
        conditions.push(
          eq(schema.policyRuleEvaluation.versionId, input.versionId),
        );
      }

      const recentVersionRows = await ctx.db
        .selectDistinct({
          versionId: schema.policyRuleEvaluation.versionId,
          createdAt: schema.deploymentVersion.createdAt,
        })
        .from(schema.policyRuleEvaluation)
        .innerJoin(
          schema.deploymentVersion,
          eq(
            schema.policyRuleEvaluation.versionId,
            schema.deploymentVersion.id,
          ),
        )
        .where(and(...conditions))
        .orderBy(desc(schema.deploymentVersion.createdAt))
        .limit(input.limit);

      const versionIds = recentVersionRows.map((r) => r.versionId);
      if (versionIds.length === 0) return [];

      const rows = await ctx.db
        .select({
          evaluation: schema.policyRuleEvaluation,
          version: {
            id: schema.deploymentVersion.id,
            name: schema.deploymentVersion.name,
            tag: schema.deploymentVersion.tag,
            createdAt: schema.deploymentVersion.createdAt,
            status: schema.deploymentVersion.status,
          },
        })
        .from(schema.policyRuleEvaluation)
        .innerJoin(
          schema.deploymentVersion,
          eq(
            schema.policyRuleEvaluation.versionId,
            schema.deploymentVersion.id,
          ),
        )
        .where(
          and(
            ...conditions,
            inArray(schema.policyRuleEvaluation.versionId, versionIds),
          ),
        )
        .orderBy(
          desc(schema.deploymentVersion.createdAt),
          desc(schema.policyRuleEvaluation.evaluatedAt),
        );

      return rows;
    }),
});
