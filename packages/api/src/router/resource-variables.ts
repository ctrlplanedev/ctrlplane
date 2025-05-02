import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const updateResourceVariableQueue = getQueue(Channel.UpdateResourceVariable);

export const resourceVariables = createTRPCRouter({
  // For direct variables only
  create: protectedProcedure
    .input(
      z.object({
        resourceId: z.string().uuid(),
        key: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
        sensitive: z.boolean().optional().default(false),
        valueType: z.literal("direct"),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: input.resourceId }),
    })
    .mutation(async ({ ctx, input }) => {
      const value = input.sensitive
        ? variablesAES256().encrypt(String(input.value))
        : input.value;

      const variable = await ctx.db
        .insert(schema.resourceVariable)
        .values({
          ...input,
          value,
          reference: null,
          path: null,
        })
        .returning()
        .then(takeFirst);

      const parsedVariable = schema.resourceVariableSchema.parse(variable);
      await updateResourceVariableQueue.add(parsedVariable.id, parsedVariable);
      return parsedVariable;
    }),

  createReference: protectedProcedure
    .input(
      z.object({
        resourceId: z.string().uuid(),
        key: z.string(),
        reference: z.string(),
        path: z.array(z.string()),
        defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
        sensitive: z.boolean().optional().default(false),
        valueType: z.literal("reference"),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: input.resourceId }),
    })
    .mutation(async ({ ctx, input }) => {
      const data = {
        ...input,
        defaultValue: input.defaultValue ?? undefined,
        value: null,
      };

      const variable = await ctx.db
        .insert(schema.resourceVariable)
        .values(data)
        .returning()
        .then(takeFirst);

      const parsedVariable = schema.resourceVariableSchema.parse(variable);
      await updateResourceVariableQueue.add(parsedVariable.id, parsedVariable);
      return parsedVariable;
    }),

  update: protectedProcedure
    .input(
      z.object({ id: z.string().uuid(), data: schema.updateResourceVariable }),
    )
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const variable = await ctx.db
          .select()
          .from(schema.resourceVariable)
          .where(eq(schema.resourceVariable.id, input.id))
          .then(takeFirstOrNull);
        if (!variable) return false;

        return canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: variable.resourceId });
      },
    })
    .mutation(async ({ ctx, input }) => {
      const { sensitive } = input.data;
      const value = sensitive
        ? variablesAES256().encrypt(String(input.data.value))
        : input.data.value;
      const data = { ...input.data, value };
      return ctx.db
        .update(schema.resourceVariable)
        .set(data)
        .where(eq(schema.resourceVariable.id, input.id))
        .returning()
        .then(takeFirst)
        .then(async (variable) => {
          const parsedVariable = schema.resourceVariableSchema.parse(variable);
          await updateResourceVariableQueue.add(
            parsedVariable.id,
            parsedVariable,
          );
          return parsedVariable;
        });
    }),

  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const variable = await ctx.db
          .select()
          .from(schema.resourceVariable)
          .where(eq(schema.resourceVariable.id, input))
          .then(takeFirstOrNull);
        if (!variable) return false;

        return canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: variable.resourceId });
      },
    })
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .delete(schema.resourceVariable)
        .where(eq(schema.resourceVariable.id, input))
        .returning()
        .then(takeFirst)
        .then(async (variable) => {
          const parsedVariable = schema.resourceVariableSchema.parse(variable);
          await updateResourceVariableQueue.add(
            parsedVariable.id,
            parsedVariable,
          );
          return parsedVariable;
        }),
    ),
});
