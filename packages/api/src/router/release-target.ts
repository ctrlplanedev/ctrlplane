import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const releaseTargetRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          resourceId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          deploymentId: z.string().uuid().optional(),
        })
        .refine(
          (data) =>
            data.resourceId != null ||
            data.environmentId != null ||
            data.deploymentId != null,
        ),
    )
    .meta({
      authorizationCheck: async ({ canUser, input }) => {
        const resourceResult =
          input.resourceId != null
            ? await canUser.perform(Permission.ResourceGet).on({
                type: "resource",
                id: input.resourceId,
              })
            : true;

        const environmentResult =
          input.environmentId != null
            ? await canUser.perform(Permission.EnvironmentGet).on({
                type: "environment",
                id: input.environmentId,
              })
            : true;

        const deploymentResult =
          input.deploymentId != null
            ? await canUser.perform(Permission.DeploymentGet).on({
                type: "deployment",
                id: input.deploymentId,
              })
            : true;

        return resourceResult && environmentResult && deploymentResult;
      },
    })
    .query(async ({ ctx, input }) => {
      const { resourceId, environmentId, deploymentId } = input;

      return ctx.db.query.releaseTarget.findMany({
        where: and(
          ...[
            resourceId != null
              ? eq(schema.releaseTarget.resourceId, resourceId)
              : undefined,
            environmentId != null
              ? eq(schema.releaseTarget.environmentId, environmentId)
              : undefined,
            deploymentId != null
              ? eq(schema.releaseTarget.deploymentId, deploymentId)
              : undefined,
          ].filter(isPresent),
        ),
        with: {
          resource: true,
          environment: true,
          deployment: true,
        },
        limit: 500,
      });
    }),
});
