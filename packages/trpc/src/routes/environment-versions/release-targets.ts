import { z } from "zod";

import { protectedProcedure } from "../../trpc.js";
import { getAllReleaseTargets } from "./util.js";

export const releaseTargets = protectedProcedure
  .input(
    z.object({
      workspaceId: z.uuid(),
      environmentId: z.uuid(),
      versionId: z.uuid(),
    }),
  )
  .query(async ({ input }) => {
    const { workspaceId, environmentId, versionId } = input;
    return getAllReleaseTargets(workspaceId, environmentId, versionId);
  });
