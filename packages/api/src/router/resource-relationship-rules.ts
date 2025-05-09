import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
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
        with: { metadataMatches: true, metadataEquals: true },
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
      const { metadataKeysMatch, metadataKeysEquals, ...rest } = input;
      const rule = await ctx.db
        .insert(schema.resourceRelationshipRule)
        .values({
          ...rest,
          targetVersion: rest.targetVersion === "" ? null : rest.targetVersion,
          targetKind: rest.targetKind === "" ? null : rest.targetKind,
        })
        .returning()
        .then(takeFirst);

      if (metadataKeysMatch != null && metadataKeysMatch.length > 0)
        await ctx.db
          .insert(schema.resourceRelationshipRuleMetadataMatch)
          .values(
            metadataKeysMatch.map((key) => ({
              resourceRelationshipRuleId: rule.id,
              key,
            })),
          );

      if (metadataKeysEquals != null && metadataKeysEquals.length > 0)
        await ctx.db
          .insert(schema.resourceRelationshipTargetRuleMetadataEquals)
          .values(
            metadataKeysEquals.map(({ key, value }) => ({
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
        const { metadataKeysMatch, metadataKeysEquals, ...rest } = data;

        const rule = await tx
          .update(schema.resourceRelationshipRule)
          .set(rest)
          .where(eq(schema.resourceRelationshipRule.id, id))
          .returning()
          .then(takeFirst);

        if (metadataKeysMatch != null) {
          await tx
            .delete(schema.resourceRelationshipRuleMetadataMatch)
            .where(
              eq(
                schema.resourceRelationshipRuleMetadataMatch
                  .resourceRelationshipRuleId,
                id,
              ),
            );

          if (metadataKeysMatch.length > 0)
            await tx
              .insert(schema.resourceRelationshipRuleMetadataMatch)
              .values(
                metadataKeysMatch.map((key) => ({
                  resourceRelationshipRuleId: id,
                  key,
                })),
              );
        }

        if (metadataKeysEquals != null) {
          await tx
            .delete(schema.resourceRelationshipTargetRuleMetadataEquals)
            .where(
              eq(
                schema.resourceRelationshipTargetRuleMetadataEquals
                  .resourceRelationshipRuleId,
                id,
              ),
            );

          if (metadataKeysEquals.length > 0)
            await tx
              .insert(schema.resourceRelationshipTargetRuleMetadataEquals)
              .values(
                metadataKeysEquals.map(({ key, value }) => ({
                  resourceRelationshipRuleId: id,
                  key,
                  value,
                })),
              );
        }

        return {
          ...rule,
          metadataMatches: metadataKeysMatch ?? [],
          metadataEquals: metadataKeysEquals ?? [],
        };
      });
    }),
});
