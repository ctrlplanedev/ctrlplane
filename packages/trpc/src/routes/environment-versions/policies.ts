import { z } from "zod";

import { protectedProcedure } from "../../trpc.js";

export const policies = protectedProcedure
  .input(
    z.object({
      workspaceId: z.uuid(),
      environmentId: z.uuid(),
      versionId: z.uuid(),
    }),
  )
  .query(async () => {
    return Promise.resolve([]);
  });
