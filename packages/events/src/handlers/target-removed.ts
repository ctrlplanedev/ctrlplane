import type { TargetRemoved } from "@ctrlplane/validators/events";

import { and, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { dispatchRunbook } from "@ctrlplane/job-dispatch";

export const handleTargetRemoved = async (event: TargetRemoved) => {
  const { target, deployment } = event.payload;

  const isSubscribedToTargetRemoved = and(
    eq(SCHEMA.hook.scopeId, deployment.id),
    eq(SCHEMA.hook.scopeType, "deployment"),
    eq(SCHEMA.hook.event, "target.removed"),
  );
  const runhooks = await db
    .select()
    .from(SCHEMA.runhook)
    .innerJoin(SCHEMA.hook, eq(SCHEMA.runhook.hookId, SCHEMA.hook.id))
    .where(isSubscribedToTargetRemoved);

  const targetId = target.id;
  const deploymentId = deployment.id;
  const handleRunhooksPromises = runhooks.map(({ runhook }) =>
    dispatchRunbook(db, runhook.runbookId, { targetId, deploymentId }),
  );

  await Promise.all(handleRunhooksPromises);
};
