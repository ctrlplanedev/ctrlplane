import type { ResourceRemoved } from "@ctrlplane/validators/events";

import { and, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { HookAction } from "@ctrlplane/validators/events";

import { dispatchRunbook } from "../../job-dispatch.js";

export const handleResourceRemoved = async (event: ResourceRemoved) => {
  const { resource, deployment } = event.payload;
  const { workspaceId } = resource;
  await db.insert(SCHEMA.event).values({ ...event, workspaceId });

  const isSubscribedToResourceRemoved = and(
    eq(SCHEMA.hook.scopeId, deployment.id),
    eq(SCHEMA.hook.scopeType, "deployment"),
    eq(SCHEMA.hook.action, HookAction.DeploymentResourceRemoved),
  );
  const runhooks = await db
    .select()
    .from(SCHEMA.runhook)
    .innerJoin(SCHEMA.hook, eq(SCHEMA.runhook.hookId, SCHEMA.hook.id))
    .where(isSubscribedToResourceRemoved);

  if (runhooks.length === 0) return;

  const resourceId = resource.id;
  const deploymentId = deployment.id;
  const handleRunhooksPromises = runhooks.map(({ runhook }) =>
    dispatchRunbook(db, runhook.runbookId, { resourceId, deploymentId }),
  );

  await Promise.all(handleRunhooksPromises);
};
