import _ from "lodash";
import { z } from "zod";

import { eq } from "@ctrlplane/db";
import {
  deployment,
  release,
  releaseMetadata,
  system,
} from "@ctrlplane/db/schema";
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
        .selectDistinct({ key: releaseMetadata.key })
        .from(release)
        .innerJoin(releaseMetadata, eq(releaseMetadata.releaseId, release.id))
        .innerJoin(deployment, eq(release.deploymentId, deployment.id))
        .where(eq(deployment.systemId, input))
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
        .selectDistinct({ key: releaseMetadata.key })
        .from(release)
        .innerJoin(releaseMetadata, eq(releaseMetadata.releaseId, release.id))
        .innerJoin(deployment, eq(release.deploymentId, deployment.id))
        .innerJoin(system, eq(deployment.systemId, system.id))
        .where(eq(system.workspaceId, input))
        .then((r) => r.map((row) => row.key)),
    ),
});
