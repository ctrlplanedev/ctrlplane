import z from "zod";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

export const resourceProvidersRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        limit: z.number().min(1).max(1000).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { workspaceId, limit, offset } = input;
      const providers = ctx.db.query.resourceProvider.findMany({
        where: eq(schema.resourceProvider.workspaceId, workspaceId),
        offset: offset,
        limit: limit,
      });
      return providers;
    }),
});
