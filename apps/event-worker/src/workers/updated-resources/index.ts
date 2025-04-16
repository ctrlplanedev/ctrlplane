import { eq, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";

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
      .resources([resource.id])
      .releaseTargets()
      .replace();

    const jobs = rts.map((rt) => ({
      name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
      data: rt,
    }));
    await getQueue(Channel.EvaluateReleaseTarget).addBulk(jobs);

    const exitedDeployments = currentDeployments.filter(
      (d) => !rts.some((nrt) => nrt.deploymentId === d.id),
    );
    await dispatchExitHooks(exitedDeployments, resource);
  }),
);
