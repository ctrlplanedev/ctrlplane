import _ from "lodash";

import { and, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { getResourceChildren } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, dispatchQueueJob } from "@ctrlplane/events";

import { createSpanWrapper } from "./span.js";

const getAffectedReleaseTargets = async (resourceId: string) => {
  const resourceChildren = await getResourceChildren(db, resourceId);
  const releaseTargets = await db
    .selectDistinctOn([schema.releaseTarget.id])
    .from(schema.releaseTarget)
    .where(
      and(
        inArray(
          schema.releaseTarget.resourceId,
          resourceChildren.map((dr) => dr.target.id),
        ),
      ),
    );

  return releaseTargets;
};

export const updatedResourceWorker = createWorker(
  Channel.UpdatedResource,
  createSpanWrapper(
    "updatedResourceWorker",
    async (span, { data: resource }) => {
      span.setAttribute("resource.id", resource.id);
      span.setAttribute("resource.name", resource.name);
      span.setAttribute("workspace.id", resource.workspaceId);

      const workspace = await db.query.workspace.findFirst({
        where: eq(schema.workspace.id, resource.workspaceId),
        with: { systems: { with: { environments: true, deployments: true } } },
      });

      if (workspace == null) throw new Error("Workspace not found");

      const deployments = workspace.systems.flatMap(
        ({ deployments }) => deployments,
      );

      const environments = workspace.systems.flatMap(
        ({ environments }) => environments,
      );

      for (const deployment of deployments)
        await dispatchQueueJob()
          .toCompute()
          .deployment(deployment)
          .resourceSelector();

      for (const environment of environments)
        await dispatchQueueJob()
          .toCompute()
          .environment(environment)
          .resourceSelector();

      const affectedReleaseTargets = await getAffectedReleaseTargets(
        resource.id,
      );
      await dispatchQueueJob()
        .toEvaluate()
        .releaseTargets(affectedReleaseTargets);
    },
  ),
  { concurrency: 25 },
);
