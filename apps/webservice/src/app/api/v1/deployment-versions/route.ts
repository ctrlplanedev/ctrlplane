import { NextResponse } from "next/server";
import httpStatus from "http-status";
import { z } from "zod";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
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
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const bodySchema = schema.createDeploymentVersion.and(
  z.object({
    metadata: z.record(z.string()).optional(),
    status: z.nativeEnum(DeploymentVersionStatus).optional(),
  }),
);

export const POST = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .use(
    authz(({ ctx, can }) =>
      can
        .perform(Permission.DeploymentVersionCreate)
        .on({ type: "deployment", id: ctx.body.deploymentId }),
    ),
  )
  .handle<{ user: schema.User; body: z.infer<typeof bodySchema> }>(
    async (ctx) => {
      const { req, body } = ctx;
      const { name, tag, metadata = {} } = body;

      const versionName = name ?? tag;

      try {
        const prevVersion = await db
          .select()
          .from(schema.deploymentVersion)
          .where(
            and(
              eq(schema.deploymentVersion.deploymentId, body.deploymentId),
              eq(schema.deploymentVersion.tag, tag),
            ),
          )
          .then(takeFirstOrNull);

        const depVersion = await db
          .insert(schema.deploymentVersion)
          .values({ ...body, name: versionName, tag })
          .onConflictDoUpdate({
            target: [
              schema.deploymentVersion.deploymentId,
              schema.deploymentVersion.tag,
            ],
            set: buildConflictUpdateColumns(schema.deploymentVersion, [
              "name",
              "status",
              "message",
              "config",
              "jobAgentConfig",
            ]),
          })
          .returning()
          .then(takeFirst);

        if (Object.keys(metadata).length > 0)
          await db
            .insert(schema.deploymentVersionMetadata)
            .values(
              Object.entries(metadata).map(([key, value]) => ({
                versionId: depVersion.id,
                key,
                value,
              })),
            )
            .onConflictDoUpdate({
              target: [
                schema.deploymentVersionMetadata.versionId,
                schema.deploymentVersionMetadata.key,
              ],
              set: buildConflictUpdateColumns(
                schema.deploymentVersionMetadata,
                ["value"],
              ),
            });

        const shouldTrigger =
          prevVersion == null ||
          (prevVersion.status !== DeploymentVersionStatus.Ready &&
            depVersion.status === DeploymentVersionStatus.Ready);

        if (shouldTrigger) {
          getQueue(Channel.NewDeploymentVersion).add(depVersion.id, depVersion);

          await createReleaseJobTriggers(db, "new_version")
            .causedById(ctx.user.id)
            .filter(isPassingChannelSelectorPolicy)
            .versions([depVersion.id])
            .then(createJobApprovals)
            .insert()
            .then((releaseJobTriggers) => {
              dispatchReleaseJobTriggers(db)
                .releaseTriggers(releaseJobTriggers)
                .filter(isPassingAllPolicies)
                .then(cancelOldReleaseJobTriggersOnJobDispatch)
                .dispatch();
            })
            .then(() =>
              logger.info(
                `Release for ${depVersion.id} job triggers created and dispatched.`,
                req,
              ),
            );
        }

        return NextResponse.json(
          { ...depVersion, metadata },
          { status: httpStatus.CREATED },
        );
      } catch (error) {
        if (error instanceof z.ZodError)
          return NextResponse.json(
            { error: error.errors },
            { status: httpStatus.BAD_REQUEST },
          );

        logger.error("Error creating release:", error);
        return NextResponse.json(
          { error: "Internal Server Error" },
          { status: httpStatus.INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
