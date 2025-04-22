import { NextResponse } from "next/server";
import httpStatus from "http-status";
import { z } from "zod";

import { buildConflictUpdateColumns, eq, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createJobApprovals,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
  isPassingChannelSelectorPolicy,
} from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

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
    { body: z.infer<typeof patchSchema>; user: SCHEMA.User },
    { params: Promise<{ deploymentVersionId: string }> }
  >(async (ctx, { params }) => {
    const { deploymentVersionId } = await params;
    const { body, user, req } = ctx;

    try {
      const deploymentVersion = await ctx.db
        .update(SCHEMA.deploymentVersion)
        .set(body)
        .where(eq(SCHEMA.deploymentVersion.id, deploymentVersionId))
        .returning()
        .then(takeFirst);

      if (Object.keys(body.metadata ?? {}).length > 0)
        await ctx.db
          .insert(SCHEMA.deploymentVersionMetadata)
          .values(
            Object.entries(body.metadata ?? {}).map(([key, value]) => ({
              versionId: deploymentVersionId,
              key,
              value,
            })),
          )
          .onConflictDoUpdate({
            target: [
              SCHEMA.deploymentVersionMetadata.key,
              SCHEMA.deploymentVersionMetadata.versionId,
            ],
            set: buildConflictUpdateColumns(SCHEMA.deploymentVersionMetadata, [
              "value",
            ]),
          });

      await createReleaseJobTriggers(ctx.db, "version_updated")
        .causedById(user.id)
        .filter(isPassingChannelSelectorPolicy)
        .versions([deploymentVersionId])
        .then(createJobApprovals)
        .insert()
        .then((releaseJobTriggers) => {
          dispatchReleaseJobTriggers(ctx.db)
            .releaseTriggers(releaseJobTriggers)
            .filter(isPassingAllPolicies)
            .then(cancelOldReleaseJobTriggersOnJobDispatch)
            .dispatch();
        })
        .then(() =>
          logger.info(
            `Version for ${deploymentVersionId} job triggers created and dispatched.`,
            req,
          ),
        );

      return NextResponse.json(deploymentVersion);
    } catch (error) {
      logger.error(error);
      return NextResponse.json(
        { error: "Failed to update version" },
        { status: httpStatus.INTERNAL_SERVER_ERROR },
      );
    }
  });
