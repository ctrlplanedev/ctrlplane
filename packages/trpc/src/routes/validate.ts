import { z } from "zod";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { publicProcedure, router } from "../trpc.js";

export const validateRouter = router({
  resourceSelector: publicProcedure
    .input(
      z.object({
        cel: z.string().min(1).max(255),
      }),
    )
    .query(async ({ input }) => {
      const result = await getClientFor("any").POST(
        "/v1/validate/resource-selector",
        {
          body: {
            resourceSelector: {
              cel: input.cel,
            },
          },
        },
      );

      return result.data;
    }),
});
