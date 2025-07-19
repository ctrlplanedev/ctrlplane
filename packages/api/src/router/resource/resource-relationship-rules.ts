import _ from "lodash";
import { z } from "zod";

import { and, asc, eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const matchingMetadataKeys = protectedProcedure
  .input(
    z.object({
      workspaceId: z.string().uuid(),
      source: z.object({ kind: z.string(), version: z.string() }).optional(),
      target: z
        .object({
          kind: z.string().optional().nullable(),
          version: z.string().optional().nullable(),
        })
        .optional(),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.ResourceList).on({
        type: "workspace",
        id: input.workspaceId,
      }),
  })
  .query(async ({ ctx, input }) => {
    const { workspaceId, source, target } = input;

    const sourceMetadata = await ctx.db
      .selectDistinct({
        key: schema.resourceMetadata.key,
        value: schema.resourceMetadata.value,
      })
      .from(schema.resourceMetadata)
      .innerJoin(
        schema.resource,
        eq(schema.resourceMetadata.resourceId, schema.resource.id),
      )
      .where(
        and(
          eq(schema.resource.workspaceId, workspaceId),
          source == null ? undefined : eq(schema.resource.kind, source.kind),
          source == null
            ? undefined
            : eq(schema.resource.version, source.version),
        ),
      );

    const targetMetadata = await ctx.db
      .selectDistinct({
        key: schema.resourceMetadata.key,
        value: schema.resourceMetadata.value,
      })
      .from(schema.resourceMetadata)
      .innerJoin(
        schema.resource,
        eq(schema.resourceMetadata.resourceId, schema.resource.id),
      )
      .where(
        and(
          eq(schema.resource.workspaceId, workspaceId),
          target?.kind == null
            ? undefined
            : eq(schema.resource.kind, target.kind),
          target?.version == null
            ? undefined
            : eq(schema.resource.version, target.version),
        ),
      );

    const sourceMetaGrouped = _.chain(sourceMetadata)
      .groupBy((m) => m.key)
      .map((keyGroup) => {
        const key = keyGroup[0]!.key;
        const values = _.chain(keyGroup)
          .map((m) => m.value)
          .uniq()
          .value();

        return { key, values };
      })
      .value();

    const targetMetaGrouped = _.chain(targetMetadata)
      .groupBy((m) => m.key)
      .map((keyGroup) => {
        const key = keyGroup[0]!.key;
        const values = _.chain(keyGroup)
          .map((m) => m.value)
          .uniq()
          .value();

        return { key, values };
      })
      .value();

    return sourceMetaGrouped.map((sourceMeta) => {
      const { key, values } = sourceMeta;

      const targetMetaWithMatchingValue = targetMetaGrouped
        .filter((targetMetaGroup) =>
          targetMetaGroup.values.some((targetVal) =>
            values.includes(targetVal),
          ),
        )
        .map(({ key }) => key);

      return { key, targetMetaWithMatchingValue };
    });
  });

const metadataEquals = protectedProcedure
  .input(
    z.object({
      workspaceId: z.string().uuid(),
      kind: z.string().optional().nullable(),
      version: z.string().optional().nullable(),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.ResourceList).on({
        type: "workspace",
        id: input.workspaceId,
      }),
  })
  .query(async ({ ctx, input }) => {
    const { workspaceId, kind, version } = input;
    const metadata = await ctx.db
      .select()
      .from(schema.resourceMetadata)
      .innerJoin(
        schema.resource,
        eq(schema.resourceMetadata.resourceId, schema.resource.id),
      )
      .where(
        and(
          eq(schema.resource.workspaceId, workspaceId),
          kind == null ? undefined : eq(schema.resource.kind, kind),
          version == null ? undefined : eq(schema.resource.version, version),
        ),
      );

    return _.chain(metadata)
      .groupBy((m) => m.resource_metadata.key)
      .map((keyGroup) => {
        const key = keyGroup[0]!.resource_metadata.key;
        const values = _.chain(keyGroup)
          .map((m) => m.resource_metadata.value)
          .uniq()
          .value();

        return { key, values };
      })
      .value();
  });

const metadata = createTRPCRouter({
  matchingKeys: matchingMetadataKeys,
  equals: metadataEquals,
});

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
        with: {
          metadataKeysMatches: true,
          targetMetadataEquals: true,
          sourceMetadataEquals: true,
        },
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

  metadata,
});
