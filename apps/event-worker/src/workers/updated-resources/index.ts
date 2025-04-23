import _ from "lodash";

import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { withSpan } from "./span.js";

// const dispatchExitHooks = async (
//   deployments: SCHEMA.Deployment[],
//   exitedResource: SCHEMA.Resource,
// ) => {
//   const events = deployments.map((deployment) => ({
//     action: "deployment.resource.removed" as const,
//     payload: { deployment, resource: exitedResource },
//   }));

//   const handleEventPromises = events.map(handleEvent);
//   await Promise.allSettled(handleEventPromises);
// };

export const updatedResourceWorker = createWorker(
  Channel.UpdatedResource,
  withSpan("updatedResourceWorker", async (span, { data: resource }) => {
    span.setAttribute("resource.id", resource.id);
    span.setAttribute("resource.name", resource.name);
    span.setAttribute("workspace.id", resource.workspaceId);

    await getQueue(Channel.ComputeDeploymentResourceSelector).add(
      resource.id,
      resource,
      { jobId: resource.id },
    );

    // const currentReleaseTargets = await db.query.releaseTarget.findMany({
    //   where: eq(SCHEMA.releaseTarget.resourceId, resource.id),
    //   with: { deployment: true },
    // });
    // const currentDeployments = currentReleaseTargets.map((rt) => rt.deployment);

    // const exitedDeployments = _.chain(currentDeployments)
    //   .filter((d) => !rts.some((nrt) => nrt.deploymentId === d.id))
    //   .uniqBy((d) => d.id)
    //   .value();
    // await dispatchExitHooks(exitedDeployments, resource);
  }),
);
