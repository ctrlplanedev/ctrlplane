import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const resourceVariables = createTRPCRouter({
  // For direct variables only
  create: protectedProcedure
    .input(schema.createResourceVariable)
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

      await eventDispatcher.dispatchResourceVariableCreated(variable);
      return variable;
    }),

  createReference: protectedProcedure
    .input(schema.createResourceVariable)
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

      await eventDispatcher.dispatchResourceVariableCreated(variable);
      return variable;
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
      const prevVariable = await ctx.db
        .select()
        .from(schema.resourceVariable)
        .where(eq(schema.resourceVariable.id, input.id))
        .then(takeFirst);

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
          await eventDispatcher.dispatchResourceVariableUpdated(
            prevVariable,
            variable,
          );
          return variable;
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
          await eventDispatcher.dispatchResourceVariableDeleted(variable);
          return variable;
        }),
    ),
});
