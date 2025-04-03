import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";

import "@ctrlplane/db/schema";

import {
  createVariableSet,
  updateVariableSet,
  variableSet,
  variableSetValue,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const variableSetRouter = createTRPCRouter({
  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.VariableSetGet).on({
          type: "variableSet",
          id: input,
        }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db.query.variableSet.findFirst({
        where: eq(variableSet.id, input),
        with: { values: true },
      }),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.VariableSetCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createVariableSet)
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const vs = await tx
          .insert(variableSet)
          .values(input)
          .returning()
          .then(takeFirst);
        await tx.insert(variableSetValue).values(
          input.values.map((value) => ({
            key: value.key,
            value: value.value,
            variableSetId: vs.id,
          })),
        );
        return tx.query.variableSet.findFirst({
          where: eq(variableSet.id, vs.id),
          with: { values: true },
        });
      }),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "variableSet", id: input.id }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateVariableSet,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        await tx
          .update(variableSet)
          .set(input.data)
          .where(eq(variableSet.id, input.id))
          .returning()
          .then(takeFirst);

        if (input.data.values != null) {
          await tx
            .delete(variableSetValue)
            .where(eq(variableSetValue.variableSetId, input.id));
          await tx.insert(variableSetValue).values(
            input.data.values.map((value) => ({
              key: value.key,
              value: value.value,
              variableSetId: input.id,
            })),
          );
        }
      }),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "variableSet", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db.delete(variableSet).where(eq(variableSet.id, input)),
    ),
});
