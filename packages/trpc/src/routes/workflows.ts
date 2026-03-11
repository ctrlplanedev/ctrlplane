import { z } from "zod";

import { protectedProcedure, router } from "../trpc.js";

export const workflowsRouter = router({
  get: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        workflowId: z.string(),
      }),
    )
    .query(() => {}),

  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(() => {}),

  runs: router({
    create: protectedProcedure
      .input(
        z.object({
          workspaceId: z.uuid(),
          workflowId: z.string(),
          inputs: z.record(z.string(), z.any()),
        }),
      )
      .mutation(() => {}),

    list: protectedProcedure
      .input(
        z.object({
          workspaceId: z.uuid(),
          workflowId: z.string(),
          limit: z.number().min(1).max(1000).default(100),
          offset: z.number().min(0).default(0),
        }),
      )
      .query(() => {}),
  }),
});
