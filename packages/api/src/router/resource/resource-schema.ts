import { z } from "zod";

import { and, eq } from "@ctrlplane/db";
import { resourceSchema } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const resourceSchemaRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        kind: z.string().optional(),
        version: z.string().optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const conditions = [eq(resourceSchema.workspaceId, input.workspaceId)];

      if (input.kind) conditions.push(eq(resourceSchema.kind, input.kind));
      if (input.version)
        conditions.push(eq(resourceSchema.version, input.version));

      return ctx.db
        .select()
        .from(resourceSchema)
        .where(and(...conditions))
        .orderBy(resourceSchema.kind, resourceSchema.version);
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const schema = await ctx.db
          .select()
          .from(resourceSchema)
          .where(eq(resourceSchema.id, input))
          .then((rows) => rows[0]);

        if (!schema) return false;

        return canUser
          .perform(Permission.ResourceDelete)
          .on({ type: "workspace", id: schema.workspaceId });
      },
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(resourceSchema)
        .where(eq(resourceSchema.id, input))
        .returning(),
    ),
});
