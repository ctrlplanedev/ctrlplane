import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { eq } from "@ctrlplane/db";
import { createTeam, team, updateTeam } from "@ctrlplane/db/schema";

import { protectedProcedure } from "../trpc";

export const teamRouter: TRPCRouterRecord = {
  create: protectedProcedure
    .input(createTeam)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(team).values(input).returning(),
    ),

  byId: protectedProcedure
    .input(z.string())
    .mutation(({ ctx, input }) =>
      ctx.db.query.team.findFirst({ where: eq(team.id, input) }),
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: updateTeam }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(team)
        .set(input.data)
        .where(eq(team.id, input.id))
        .returning(),
    ),
};
