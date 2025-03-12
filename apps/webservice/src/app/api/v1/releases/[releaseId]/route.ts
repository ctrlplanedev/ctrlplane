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
  isPassingReleaseStringCheckPolicy,
} from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

const patchSchema = SCHEMA.updateRelease.and(
  z.object({ metadata: z.record(z.string()).optional() }),
);

export const PATCH = request()
  .use(authn)
  .use(parseBody(patchSchema))
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.ReleaseUpdate)
        .on({ type: "release", id: params.releaseId }),
    ),
  )
  .handle<
    { body: z.infer<typeof patchSchema>; user: SCHEMA.User },
    { params: { releaseId: string } }
  >(async (ctx, { params }) => {
    const { releaseId } = params;
    const { body, user, req } = ctx;

    try {
      const release = await ctx.db
        .update(SCHEMA.deploymentVersion)
        .set(body)
        .where(eq(SCHEMA.deploymentVersion.id, releaseId))
        .returning()
        .then(takeFirst);

      if (Object.keys(body.metadata ?? {}).length > 0)
        await ctx.db
          .insert(SCHEMA.releaseMetadata)
          .values(
            Object.entries(body.metadata ?? {}).map(([key, value]) => ({
              releaseId,
              key,
              value,
            })),
          )
          .onConflictDoUpdate({
            target: [
              SCHEMA.releaseMetadata.key,
              SCHEMA.releaseMetadata.releaseId,
            ],
            set: buildConflictUpdateColumns(SCHEMA.releaseMetadata, ["value"]),
          });

      await createReleaseJobTriggers(ctx.db, "release_updated")
        .causedById(user.id)
        .filter(isPassingReleaseStringCheckPolicy)
        .releases([releaseId])
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
            `Release for ${releaseId} job triggers created and dispatched.`,
            req,
          ),
        );

      return NextResponse.json(release);
    } catch (error) {
      logger.error(error);
      return NextResponse.json(
        { error: "Failed to update release" },
        { status: httpStatus.INTERNAL_SERVER_ERROR },
      );
    }
  });
