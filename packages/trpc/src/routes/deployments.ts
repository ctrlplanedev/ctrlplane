import { z } from "zod";

import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure, router } from "../trpc.js";
import { wsEngine } from "../ws-engine.js";

export const deploymentsRouter = router({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.string() }))
    .query(({ input }) => {
      return wsEngine.GET("/v1/workspaces/{workspaceId}/deployments", {
        params: {
          path: {
            workspaceId: input.workspaceId,
          },
          query: { limit: 1_000, offset: 0 },
        },
      });
    }),

  releaseTargets: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseTargetGet)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.string(), deploymentId: z.string() }))
    .query(({ input }) => {
      return wsEngine.GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/release-targets",
        {
          params: {
            path: {
              workspaceId: input.workspaceId,
              deploymentId: input.deploymentId,
            },
            query: { limit: 1_000, offset: 0 },
          },
        },
      );
    }),

  versions: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(z.object({ workspaceId: z.string(), deploymentId: z.string() }))
    .query(({ input }) => {
      return wsEngine.GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
        {
          params: {
            path: {
              workspaceId: input.workspaceId,
              deploymentId: input.deploymentId,
            },
            query: { limit: 5_000, offset: 0 },
          },
        },
      );
    }),
});
