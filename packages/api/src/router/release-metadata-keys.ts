import _ from "lodash";
import { z } from "zod";

import { eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const releaseMetadataKeysRouter = createTRPCRouter({
  bySystem: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.ReleaseGet).on({
          type: "system",
          id: input,
        }),
    })
    .input(z.string().uuid())
    .query(async ({ input, ctx }) =>
      ctx.db
        .selectDistinct({ key: SCHEMA.releaseMetadata.key })
        .from(SCHEMA.deploymentVersion)
        .innerJoin(
          SCHEMA.releaseMetadata,
          eq(SCHEMA.releaseMetadata.releaseId, SCHEMA.deploymentVersion.id),
        )
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
        )
        .where(eq(SCHEMA.deployment.systemId, input))
        .then((r) => r.map((row) => row.key)),
    ),

  byWorkspace: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.ReleaseGet).on({
          type: "workspace",
          id: input,
        }),
    })
    .input(z.string().uuid())
    .query(async ({ input, ctx }) =>
      ctx.db
        .selectDistinct({ key: SCHEMA.releaseMetadata.key })
        .from(SCHEMA.deploymentVersion)
        .innerJoin(
          SCHEMA.releaseMetadata,
          eq(SCHEMA.releaseMetadata.releaseId, SCHEMA.deploymentVersion.id),
        )
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
        )
        .innerJoin(
          SCHEMA.system,
          eq(SCHEMA.deployment.systemId, SCHEMA.system.id),
        )
        .where(eq(SCHEMA.system.workspaceId, input))
        .then((r) => r.map((row) => row.key)),
    ),
});
