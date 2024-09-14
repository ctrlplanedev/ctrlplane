import type { Tx } from "@ctrlplane/db";
import type { Job, ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";

import { createTriggeredReleaseJobs } from "./job-creation.js";
import { dispatchJobsQueue } from "./queue.js";

export type DispatchFilterFunc = (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => Promise<ReleaseJobTrigger[]> | ReleaseJobTrigger[];

type ThenFunc = (
  tx: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => Promise<void>;

class DispatchBuilder {
  private _releaseTriggers: ReleaseJobTrigger[];
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

  releaseTriggers(t: ReleaseJobTrigger[]) {
    this._releaseTriggers = t;
    return this;
  }

  then(fn: ThenFunc) {
    this._then.push(fn);
    return this;
  }

  async dispatch(): Promise<Job[]> {
    let t = this._releaseTriggers;
    for (const func of this._filters) t = await func(this.db, t);

    if (t.length === 0) return [];
    const wfs = await createTriggeredReleaseJobs(this.db, t);

    for (const func of this._then) await func(this.db, t);

    await dispatchJobsQueue.addBulk(
      wfs.map((wf) => ({ name: wf.id, data: { jobId: wf.id } })),
    );

    return wfs;
  }
}

export const dispatchReleaseJobTriggers = (db: Tx) => new DispatchBuilder(db);
