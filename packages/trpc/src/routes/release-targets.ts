import { TRPCError } from "@trpc/server";
import z from "zod";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const releaseTargetsRouter = router({
  policies: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        releaseTargetKey: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, releaseTargetKey } = input;
      const resp = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/policies",
        {
          params: { path: { workspaceId, releaseTargetKey } },
        },
      );
      if (resp.error != null)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            resp.error.error ?? "Failed to get policies for release target",
        });
      return resp.data.policies ?? [];
    }),
});
