import type { Tx } from "@ctrlplane/db";
import type { Job, ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";

import { createTriggeredReleaseJobs } from "./job-creation.js";
import { dispatchJobExecutionsQueue } from "./queue.js";

export type DispatchFilterFunc = (
  db: Tx,
  jobConfigs: ReleaseJobTrigger[],
) => Promise<ReleaseJobTrigger[]> | ReleaseJobTrigger[];

type ThenFunc = (tx: Tx, jobConfigs: ReleaseJobTrigger[]) => Promise<void>;

class DispatchBuilder {
  private _releaseTroggers: ReleaseJobTrigger[];
  private _filters: DispatchFilterFunc[];
  private _then: ThenFunc[];
  constructor(private db: Tx) {
    this._releaseTroggers = [];
    this._filters = [];
    this._then = [];
  }

  filter(...func: DispatchFilterFunc[]) {
    this._filters.push(...func);
    return this;
  }

  releaseTriggers(t: ReleaseJobTrigger[]) {
    this._releaseTroggers = t;
    return this;
  }

  then(fn: ThenFunc) {
    this._then.push(fn);
    return this;
  }

  async dispatch(): Promise<Job[]> {
    let t = this._releaseTroggers;
    for (const func of this._filters) t = await func(this.db, t);

    if (t.length === 0) return [];
    const wfs = await createTriggeredReleaseJobs(this.db, t);

    for (const func of this._then) await func(this.db, t);

    await dispatchJobExecutionsQueue.addBulk(
      wfs.map((wf) => ({ name: wf.id, data: { jobExecutionId: wf.id } })),
    );

    return wfs;
  }
}

export const dispatchJobConfigs = (db: Tx) => new DispatchBuilder(db);
