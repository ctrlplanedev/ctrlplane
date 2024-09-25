import type { Tx } from "@ctrlplane/db";

import { eq, inArray, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTriggeredRunbookJob } from "./job-creation.js";
import { dispatchJobsQueue } from "./queue.js";

export type DispatchFilterFunc = (
  db: Tx,
  releaseJobTriggers: schema.ReleaseJobTrigger[],
) => Promise<schema.ReleaseJobTrigger[]> | schema.ReleaseJobTrigger[];

type ThenFunc = (
  tx: Tx,
  releaseJobTriggers: schema.ReleaseJobTrigger[],
) => Promise<void>;

class DispatchBuilder {
  private _releaseTriggers: schema.ReleaseJobTrigger[];
  private _filters: DispatchFilterFunc[];
  private _then: ThenFunc[];
  constructor(private db: Tx) {
    this._releaseTriggers = [];
    this._filters = [];
    this._then = [];
  }

  filter(...func: DispatchFilterFunc[]) {
    this._filters.push(...func);
    return this;
  }

  releaseTriggers(t: schema.ReleaseJobTrigger[]) {
    this._releaseTriggers = t;
    return this;
  }

  then(fn: ThenFunc) {
    this._then.push(fn);
    return this;
  }

  async dispatch(): Promise<schema.Job[]> {
    let t = this._releaseTriggers;
    for (const func of this._filters) t = await func(this.db, t);

    if (t.length === 0) return [];
    const wfs = await this.db
      .select()
      .from(schema.job)
      .where(
        inArray(
          schema.job.id,
          t.map((t) => t.jobId),
        ),
      );

    for (const func of this._then) await func(this.db, t);

    await dispatchJobsQueue.addBulk(
      wfs.map((wf) => ({ name: wf.id, data: { jobId: wf.id } })),
    );

    await this.db
      .update(schema.job)
      .set({ status: JobStatus.InProgress })
      .where(
        inArray(
          schema.job.id,
          wfs.map((j) => j.id),
        ),
      );

    return wfs;
  }
}

export const dispatchReleaseJobTriggers = (db: Tx) => new DispatchBuilder(db);

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
  const job = await createTriggeredRunbookJob(db, runbook, values);
  await dispatchJobsQueue.add(job.id, { jobId: job.id });
  return job;
};
