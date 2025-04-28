import { z } from "zod";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const resourceRelationshipRulesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceList)
          .on({ type: "workspace", id: input }),
    })
    .query(async ({ ctx, input }) => {
      return ctx.db.query.resourceRelationshipRule.findMany({
        where: eq(schema.resourceRelationshipRule.workspaceId, input),
        with: {
          metadataMatches: true,
        },
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
          .perform(Permission.ResourceDelete)
          .on({ type: "workspace", id: rule.workspaceId });
      },
    })
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .delete(schema.resourceRelationshipRule)
        .where(eq(schema.resourceRelationshipRule.id, input))
        .returning();
    }),
});
