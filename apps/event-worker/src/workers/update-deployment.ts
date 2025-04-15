import _ from "lodash";

import { eq, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";

const recomputeAllPolicyDeployments = async (systemId: string) => {
  const system = await db.query.system.findFirst({
    where: eq(schema.system.id, systemId),
  });
  if (system == null) throw new Error(`System not found: ${systemId}`);
  const { workspaceId } = system;
  await selector(db)
    .compute()
    .allPolicies(workspaceId)
    .deploymentSelectors()
    .replace();
};

export const updateDeploymentWorker = createWorker(
  Channel.UpdateDeployment,
  async ({ data }) => {
    const { oldSelector, resourceSelector } = data;
    if (_.isEqual(oldSelector, resourceSelector)) return;
    await selector()
      .compute()
      .deployments([data.id])
      .resourceSelectors()
      .replace();
    recomputeAllPolicyDeployments(data.systemId);
  },
);
