import { z } from "zod";

import { asc, eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const resourceRelationshipRulesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceRelationshipRuleList)
          .on({ type: "workspace", id: input }),
    })
    .query(async ({ ctx, input }) => {
      return ctx.db.query.resourceRelationshipRule.findMany({
        where: eq(schema.resourceRelationshipRule.workspaceId, input),
        with: { metadataKeysMatches: true, targetMetadataEquals: true },
        orderBy: [
          asc(schema.resourceRelationshipRule.reference),
          asc(schema.resourceRelationshipRule.sourceKind),
          asc(schema.resourceRelationshipRule.targetKind),
        ],
      });
    }),

  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const rule = await ctx.db.query.resourceRelationshipRule.findFirst({
          where: eq(schema.resourceRelationshipRule.id, input),
        });

        if (rule == null) return false;

        return canUser
          .perform(Permission.ResourceRelationshipRuleDelete)
          .on({ type: "workspace", id: rule.workspaceId });
      },
    })
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .delete(schema.resourceRelationshipRule)
        .where(eq(schema.resourceRelationshipRule.id, input))
        .returning();
    }),

  create: protectedProcedure
    .input(schema.createResourceRelationshipRule)
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceRelationshipRuleCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .mutation(async ({ ctx, input }) => {
      const { metadataKeysMatches, targetMetadataEquals, ...rest } = input;
      const rule = await ctx.db
        .insert(schema.resourceRelationshipRule)
        .values({
          ...rest,
          targetVersion: rest.targetVersion === "" ? null : rest.targetVersion,
          targetKind: rest.targetKind === "" ? null : rest.targetKind,
        })
        .returning()
        .then(takeFirst);

      if (metadataKeysMatches != null && metadataKeysMatches.length > 0)
        await ctx.db
          .insert(schema.resourceRelationshipRuleMetadataMatch)
          .values(
            metadataKeysMatches.map(({ sourceKey, targetKey }) => ({
              resourceRelationshipRuleId: rule.id,
              sourceKey,
              targetKey,
            })),
          );

      if (targetMetadataEquals != null && targetMetadataEquals.length > 0)
        await ctx.db
          .insert(schema.resourceRelationshipTargetRuleMetadataEquals)
          .values(
            targetMetadataEquals.map(({ key, value }) => ({
              resourceRelationshipRuleId: rule.id,
              key,
              value,
            })),
          );

      return rule;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: schema.updateResourceRelationshipRule,
      }),
    )
    .meta({
      authorizationCheck: async ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceRelationshipRuleUpdate)
          .on({ type: "resourceRelationshipRule", id: input.id }),
    })
    .mutation(async ({ ctx, input }) => {
      const { id, data } = input;
      return ctx.db.transaction(async (tx) => {
        const { metadataKeysMatches, targetMetadataEquals, ...rest } = data;

        const rule = await tx
          .update(schema.resourceRelationshipRule)
          .set(rest)
          .where(eq(schema.resourceRelationshipRule.id, id))
          .returning()
          .then(takeFirst);

        if (metadataKeysMatches != null) {
          await tx
            .delete(schema.resourceRelationshipRuleMetadataMatch)
            .where(
              eq(
                schema.resourceRelationshipRuleMetadataMatch
                  .resourceRelationshipRuleId,
                id,
              ),
            );

          if (metadataKeysMatches.length > 0)
            await tx
              .insert(schema.resourceRelationshipRuleMetadataMatch)
              .values(
                metadataKeysMatches.map(({ sourceKey, targetKey }) => ({
                  resourceRelationshipRuleId: id,
                  sourceKey,
                  targetKey,
                })),
              );
        }

        if (targetMetadataEquals != null) {
          await tx
            .delete(schema.resourceRelationshipTargetRuleMetadataEquals)
            .where(
              eq(
                schema.resourceRelationshipTargetRuleMetadataEquals
                  .resourceRelationshipRuleId,
                id,
              ),
            );

          if (targetMetadataEquals.length > 0)
            await tx
              .insert(schema.resourceRelationshipTargetRuleMetadataEquals)
              .values(
                targetMetadataEquals.map(({ key, value }) => ({
                  resourceRelationshipRuleId: id,
                  key,
                  value,
                })),
              );
        }

        return {
          ...rule,
          metadataKeysMatches: metadataKeysMatches ?? [],
          targetMetadataEquals: targetMetadataEquals ?? [],
        };
      });
    }),
});
