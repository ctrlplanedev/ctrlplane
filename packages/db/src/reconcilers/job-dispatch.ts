import type { Tx } from "../common";
import { enqueue } from "./enqueue.js";

const JOB_DISPATCH_KIND = "job-dispatch";

export const enqueueJobDispatch = async (
  db: Tx,
  params: { workspaceId: string; jobId: string },
) =>
  enqueue(db, {
    workspaceId: params.workspaceId,
    kind: JOB_DISPATCH_KIND,
    scopeType: "job",
    scopeId: params.jobId,
  });
