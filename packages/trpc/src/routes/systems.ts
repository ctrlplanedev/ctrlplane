import { z } from "zod";

import { asc, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure, router } from "../trpc.js";

export const systemsRouter = router({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.uuid() }))
    .query(async ({ input, ctx }) => {
      const systems = await ctx.db.query.system.findMany({
        where: eq(schema.system.workspaceId, input.workspaceId),
        limit: 1000,
        offset: 0,
        with: {
          systemDeployments: true,
          systemEnvironments: true,
        },
        orderBy: [asc(schema.system.name), asc(schema.system.id)],
      });

      return systems;
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [system] = await ctx.db
        .insert(schema.system)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description ?? "",
        })
        .returning();

      return system;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        systemId: z.uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { systemId } = input;

      const [system] = await ctx.db
        .delete(schema.system)
        .where(eq(schema.system.id, systemId))
        .returning();

      if (system == null) throw new Error("System not found");

      return system;
    }),
});
