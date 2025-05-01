import _ from "lodash";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { withSpan } from "./span.js";

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

    const deploymentJobs = workspace.systems.flatMap((system) =>
      system.deployments.map((deployment) => ({
        name: deployment.id,
        data: deployment,
      })),
    );

    const environmentJobs = workspace.systems.flatMap((system) =>
      system.environments.map((environment) => ({
        name: environment.id,
        data: environment,
      })),
    );

    await getQueue(Channel.ComputeDeploymentResourceSelector).addBulk(
      deploymentJobs,
    );
    await getQueue(Channel.ComputeEnvironmentResourceSelector).addBulk(
      environmentJobs,
    );
  }),
);
