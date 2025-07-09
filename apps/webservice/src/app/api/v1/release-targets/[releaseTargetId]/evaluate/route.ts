import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

import { and, desc, eq, sql, takeFirst } from "@ctrlplane/db";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, dispatchQueueJob, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import {
  VariableReleaseManager,
  VersionReleaseManager,
} from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  component: "release-target-evaluate-route",
});

const logErr = (releaseTargetId: string, e: any) => {
  const estr = JSON.stringify(e, null, 2);
  console.error(
    `Failed to evaluate release target ${releaseTargetId}: ${estr}`,
  );
  log.error(`Failed to evaluate release target ${releaseTargetId}: ${estr}`);
};

const handleVersionRelease = async (tx: Tx, releaseTarget: any) => {
  try {
    const workspaceId = releaseTarget.resource.workspaceId;

    const vrm = new VersionReleaseManager(tx, {
      ...releaseTarget,
      workspaceId,
    });

    const { chosenCandidate } = await vrm.evaluate();

    if (!chosenCandidate) return null;

    const { release: versionRelease } = await vrm.upsertRelease(
      chosenCandidate.id,
    );

    return versionRelease;
  } catch (e: any) {
    logErr(releaseTarget.id, e);
    return null;
  }
};

const handleVariableRelease = async (tx: Tx, releaseTarget: any) => {
  try {
    const workspaceId = releaseTarget.resource.workspaceId;

    const varrm = new VariableReleaseManager(tx, {
      ...releaseTarget,
      workspaceId,
    });

    const { chosenCandidate: variableValues } = await varrm.evaluate();

    const { release: variableRelease } =
      await varrm.upsertRelease(variableValues);

    return variableRelease;
  } catch (e: any) {
    logErr(releaseTarget.id, e);
    return null;
  }
};

export const POST = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can.perform(Permission.ReleaseTargetGet).on({
        type: "releaseTarget",
        id: params.releaseTargetId ?? "",
      }),
    ),
  )
  .handle<object, { params: Promise<{ releaseTargetId: string }> }>(
    async ({ db }, { params }) => {
      const { releaseTargetId } = await params;

      const rt = await db.query.releaseTarget.findFirst({
        where: eq(schema.releaseTarget.id, releaseTargetId),
        with: {
          resource: true,
          environment: true,
          deployment: true,
        },
      });

      if (rt == null) {
        log.error("Release target not found", { releaseTargetId });
        return NextResponse.json(
          { error: "Release target not found" },
          { status: NOT_FOUND },
        );
      }

      try {
        const release = await db.transaction(async (tx) => {
          await tx.execute(
            sql`
              SELECT * FROM ${schema.releaseTarget}
              INNER JOIN ${schema.computedPolicyTargetReleaseTarget} ON ${eq(schema.computedPolicyTargetReleaseTarget.releaseTargetId, schema.releaseTarget.id)}
              INNER JOIN ${schema.policyTarget} ON ${eq(schema.computedPolicyTargetReleaseTarget.policyTargetId, schema.policyTarget.id)}
              WHERE ${eq(schema.releaseTarget.id, rt.id)}
              FOR UPDATE NOWAIT
            `,
          );

          const existingVersionRelease =
            await tx.query.versionRelease.findFirst({
              where: eq(schema.versionRelease.releaseTargetId, rt.id),
              orderBy: desc(schema.versionRelease.createdAt),
            });

          const existingVariableRelease =
            await tx.query.variableSetRelease.findFirst({
              where: eq(schema.variableSetRelease.releaseTargetId, rt.id),
              orderBy: desc(schema.variableSetRelease.createdAt),
            });

          const [versionRelease, variableRelease] = await Promise.all([
            handleVersionRelease(tx, rt),
            handleVariableRelease(tx, rt),
          ]);

          if (versionRelease == null || variableRelease == null) return null;

          const hasSameVersion =
            existingVersionRelease?.id === versionRelease.id;
          const hasSameVariables =
            existingVariableRelease?.id === variableRelease.id;

          if (hasSameVersion && hasSameVariables) {
            return tx.query.release.findFirst({
              where: and(
                eq(schema.release.versionReleaseId, versionRelease.id),
                eq(schema.release.variableReleaseId, variableRelease.id),
              ),
            });
          }

          return tx
            .insert(schema.release)
            .values({
              versionReleaseId: versionRelease.id,
              variableReleaseId: variableRelease.id,
            })
            .returning()
            .then(takeFirst);
        });

        if (release == null) {
          log.error(
            "Failed to evaluate release target because release was null",
            {
              releaseTargetId,
              release,
            },
          );
          return NextResponse.json(
            { error: "Failed to evaluate release target" },
            { status: INTERNAL_SERVER_ERROR },
          );
        }

        // Check if a job already exists for this release
        const existingReleaseJob = await db.query.releaseJob.findFirst({
          where: eq(schema.releaseJob.releaseId, release.id),
        });

        if (existingReleaseJob != null) {
          log.info("Release job already exists for release", {
            releaseTargetId,
            releaseId: release.id,
          });
          return NextResponse.json(release);
        }

        const newReleaseJob = await db.transaction(async (tx) =>
          createReleaseJob(tx, release),
        );

        getQueue(Channel.DispatchJob).add(newReleaseJob.id, {
          jobId: newReleaseJob.id,
        });

        return NextResponse.json(release);
      } catch (e: any) {
        const estr = JSON.stringify(e, null, 2);
        const isRowLocked = e.code === "55P03";
        const isReleaseTargetNotCommittedYet = e.code === "23503";
        if (isRowLocked || isReleaseTargetNotCommittedYet) {
          dispatchQueueJob().toEvaluate().releaseTargets([rt]);
          return NextResponse.json({
            message: "Release target is being evaluated",
          });
        }

        logErr(releaseTargetId, e);

        return NextResponse.json(
          { error: `Failed to evaluate release target: ${estr}` },
          { status: INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
