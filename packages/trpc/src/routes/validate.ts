import { z } from "zod";

import { publicProcedure, router } from "../trpc.js";
import { wsEngine } from "../ws-engine.js";

export const validateRouter = router({
  resourceSelector: publicProcedure
    .input(
      z.object({
        cel: z.string().min(1).max(255),
      }),
    )
    .query(async ({ input }) => {
      const result = await wsEngine.POST("/v1/validate/resource-selector", {
        body: {
          resourceSelector: {
            cel: input.cel,
          },
        },
      });

      return result.data;
    }),
});
