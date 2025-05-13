import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import { z } from "zod";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import { authn, authz } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

const patchSchema = SCHEMA.updateDeploymentVersion.and(
  z.object({ metadata: z.record(z.string()).optional() }),
);

export const PATCH = request()
  .use(authn)
  .use(parseBody(patchSchema))
  .use(
    authz(({ can, params }) =>
      can.perform(Permission.DeploymentVersionUpdate).on({
        type: "deploymentVersion",
        id: params.deploymentVersionId ?? "",
      }),
    ),
  )
  .handle<
    { body: z.infer<typeof patchSchema> },
    { params: Promise<{ deploymentVersionId: string }> }
  >(async (ctx, { params }) => {
    const { deploymentVersionId } = await params;
    const { body } = ctx;

    const prevDeploymentVersion = await ctx.db
      .select()
      .from(SCHEMA.deploymentVersion)
      .where(eq(SCHEMA.deploymentVersion.id, deploymentVersionId))
      .then(takeFirstOrNull);

    if (prevDeploymentVersion == null)
      return NextResponse.json(
        { error: "Deployment version not found" },
        { status: NOT_FOUND },
      );

    try {
      const deploymentVersion = await ctx.db.transaction(async (tx) => {
        const deploymentVersion = await ctx.db
          .update(SCHEMA.deploymentVersion)
          .set(body)
          .where(eq(SCHEMA.deploymentVersion.id, deploymentVersionId))
          .returning()
          .then(takeFirstOrNull);

        if (deploymentVersion == null)
          return NextResponse.json(
            { error: "Deployment version not found" },
            { status: NOT_FOUND },
          );

        const { metadata } = body;
        if (metadata === undefined)
          return { ...deploymentVersion, metadata: {} };

        await tx
          .delete(SCHEMA.deploymentVersionMetadata)
          .where(
            eq(SCHEMA.deploymentVersionMetadata.versionId, deploymentVersionId),
          );

        const deploymentVersionMetadata = await tx
          .insert(SCHEMA.deploymentVersionMetadata)
          .values(
            Object.entries(metadata).map(([key, value]) => ({
              versionId: deploymentVersionId,
              key,
              value,
            })),
          )
          .returning();

        return {
          ...deploymentVersion,
          metadata: Object.fromEntries(
            deploymentVersionMetadata.map(({ key, value }) => [key, value]),
          ),
        };
      });

      const shouldTrigger =
        deploymentVersion.status === DeploymentVersionStatus.Ready;
      if (!shouldTrigger) return NextResponse.json(deploymentVersion);

      await getQueue(Channel.NewDeploymentVersion).add(
        deploymentVersion.id,
        deploymentVersion,
      );

      return NextResponse.json(deploymentVersion);
    } catch (error) {
      logger.error(error);
      return NextResponse.json(
        { error: "Failed to update version" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });
