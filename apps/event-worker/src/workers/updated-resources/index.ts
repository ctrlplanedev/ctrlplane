import _ from "lodash";

import { and, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { getResourceChildren } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";

import { dispatchComputeDeploymentResourceSelectorJobs } from "../../utils/dispatch-compute-deployment-jobs.js";
import { dispatchComputeEnvironmentResourceSelectorJobs } from "../../utils/dispatch-compute-env-jobs.js";
import { dispatchEvaluateJobs } from "../../utils/dispatch-evaluate-jobs.js";
import { withSpan } from "./span.js";

const getAffectedReleaseTargets = async (resourceId: string) => {
  const resourceChildren = await getResourceChildren(db, resourceId);
  const releaseTargets = await db
    .selectDistinctOn([schema.releaseTarget.id])
    .from(schema.releaseTarget)
    .where(
      and(
        inArray(
          schema.releaseTarget.resourceId,
          resourceChildren.map((dr) => dr.source.id),
        ),
      ),
    );

  return releaseTargets;
};

export const updatedResourceWorker = createWorker(
  Channel.UpdatedResource,
  withSpan("updatedResourceWorker", async (span, { data: resource }) => {
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
      await dispatchComputeDeploymentResourceSelectorJobs(deployment);

    for (const environment of environments)
      await dispatchComputeEnvironmentResourceSelectorJobs(environment);

    const affectedReleaseTargets = await getAffectedReleaseTargets(resource.id);
    await dispatchEvaluateJobs(affectedReleaseTargets);
  }),
  { concurrency: 20 },
);
