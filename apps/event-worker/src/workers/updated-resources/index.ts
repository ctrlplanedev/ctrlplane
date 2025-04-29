import _ from "lodash";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
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

    const workspace = await db.query.workspace.findFirst({
      where: eq(schema.workspace.id, resource.workspaceId),
      with: { systems: { with: { environments: true, deployments: true } } },
    });

    if (workspace == null) throw new Error("Workspace not found");

    for (const system of workspace.systems) {
      for (const deployment of system.deployments) {
        getQueue(Channel.ComputeDeploymentResourceSelector).add(
          deployment.id,
          deployment,
          { deduplication: { id: deployment.id, ttl: 100 } },
        );
      }

      for (const environment of system.environments) {
        getQueue(Channel.ComputeEnvironmentResourceSelector).add(
          environment.id,
          environment,
          { deduplication: { id: environment.id, ttl: 100 } },
        );
      }
    }
  }),
);
