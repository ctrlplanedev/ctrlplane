import _ from "lodash";

import { eq, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";

import { dispatchEvaluateJobs } from "../../utils/dispatch-evaluate-jobs.js";
import { withSpan } from "./span.js";

const dispatchExitHooks = async (
  deployments: SCHEMA.Deployment[],
  exitedResource: SCHEMA.Resource,
) => {
  const events = deployments.map((deployment) => ({
    action: "deployment.resource.removed" as const,
    payload: { deployment, resource: exitedResource },
  }));

  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);
};

export const updatedResourceWorker = createWorker(
  Channel.UpdatedResource,
  withSpan("updatedResourceWorker", async (span, { data: resource }) => {
    span.setAttribute("resource.id", resource.id);
    span.setAttribute("resource.name", resource.name);
    span.setAttribute("workspace.id", resource.workspaceId);

    const currentReleaseTargets = await db.query.releaseTarget.findMany({
      where: eq(SCHEMA.releaseTarget.resourceId, resource.id),
      with: { deployment: true },
    });
    const currentDeployments = currentReleaseTargets.map((rt) => rt.deployment);

    const rts = await selector()
      .compute()
      .resources([resource])
      .releaseTargets();

    await dispatchEvaluateJobs(rts);

    const exitedDeployments = _.chain(currentDeployments)
      .filter((d) => !rts.some((nrt) => nrt.deploymentId === d.id))
      .uniqBy((d) => d.id)
      .value();
    await dispatchExitHooks(exitedDeployments, resource);
  }),
);
