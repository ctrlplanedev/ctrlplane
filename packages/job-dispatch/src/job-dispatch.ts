import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { createTriggeredRunbookJob } from "./job-creation.js";

export const dispatchRunbook = async (
  db: Tx,
  runbookId: string,
  values: Record<string, any>,
) => {
  const runbook = await db
    .select()
    .from(schema.runbook)
    .where(eq(schema.runbook.id, runbookId))
    .then(takeFirst);
  return createTriggeredRunbookJob(db, runbook, values);
};
