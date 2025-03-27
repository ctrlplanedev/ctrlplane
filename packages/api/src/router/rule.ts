import { z } from "zod";

import { asc, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { rule } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

// Validation schema for rule creation
const createRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().default(0),
  workspaceId: z.string().uuid(),
});

// Validation schema for rule updates
const updateRuleSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    priority: z.number().int().optional(),
  }),
});

export const ruleRouter = createTRPCRouter({
  // Create a new rule
  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.RuleCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createRuleSchema)
    .mutation(async ({ ctx, input }) =>
      ctx.db.insert(rule).values(input).returning().then(takeFirst),
    ),

  // Update an existing rule
  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.RuleUpdate)
          .on({ type: "rule", id: input.id }),
    })
    .input(updateRuleSchema)
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(rule)
        .set(input.data)
        .where(eq(rule.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  // Delete a rule
  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.RuleDelete).on({ type: "rule", id: input }),
    })
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) =>
      ctx.db.delete(rule).where(eq(rule.id, input)).returning().then(takeFirst),
    ),

  // Get a rule by ID
  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.RuleGet).on({ type: "rule", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(rule)
        .where(eq(rule.id, input))
        .limit(1)
        .then(takeFirstOrNull),
    ),

  // List rules for a workspace
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.RuleList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(rule)
        .where(eq(rule.workspaceId, input))
        .orderBy(asc(rule.priority), asc(rule.name)),
    ),
});
