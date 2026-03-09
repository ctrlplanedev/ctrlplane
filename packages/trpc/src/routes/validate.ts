import { parse } from "cel-js";
import { z } from "zod";

import { publicProcedure, router } from "../trpc.js";

export const validateRouter = router({
  resourceSelector: publicProcedure
    .input(
      z.object({
        cel: z.string().min(1).max(255),
      }),
    )
    .query(({ input }) => {
      const cel = parse(input.cel);
      return cel;
    }),
});
