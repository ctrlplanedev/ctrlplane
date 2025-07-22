import _ from "lodash";
import { z } from "zod";

import { eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const deploymentVersionMetadataKeysRouter = createTRPCRouter({
  bySystem: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionGet).on({
          type: "system",
          id: input,
        }),
    })
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      const keyValuePairs = await ctx.db
        .selectDistinct({
          key: SCHEMA.deploymentVersionMetadata.key,
          value: SCHEMA.deploymentVersionMetadata.value,
        })
        .from(SCHEMA.deploymentVersion)
        .innerJoin(
          SCHEMA.deploymentVersionMetadata,
          eq(
            SCHEMA.deploymentVersionMetadata.versionId,
            SCHEMA.deploymentVersion.id,
          ),
        )
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
        )
        .where(eq(SCHEMA.deployment.systemId, input));

      return _.chain(keyValuePairs)
        .groupBy((k) => k.key)
        .map((group) => {
          const { key } = group[0]!;
          return { key, values: group.map((g) => g.value) };
        })
        .value();
    }),

  byWorkspace: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionGet).on({
          type: "workspace",
          id: input,
        }),
    })
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      const keyValuePairs = await ctx.db
        .selectDistinct({
          key: SCHEMA.deploymentVersionMetadata.key,
          value: SCHEMA.deploymentVersionMetadata.value,
        })
        .from(SCHEMA.deploymentVersion)
        .innerJoin(
          SCHEMA.deploymentVersionMetadata,
          eq(
            SCHEMA.deploymentVersionMetadata.versionId,
            SCHEMA.deploymentVersion.id,
          ),
        )
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
        )
        .innerJoin(
          SCHEMA.system,
          eq(SCHEMA.deployment.systemId, SCHEMA.system.id),
        )
        .where(eq(SCHEMA.system.workspaceId, input));

      return _.chain(keyValuePairs)
        .groupBy((k) => k.key)
        .map((group) => {
          const { key } = group[0]!;
          const values = group.map((g) => g.value);
          return { key, values };
        })
        .value();
    }),
});
