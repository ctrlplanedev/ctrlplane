import type { Tx } from "@ctrlplane/db";
import type { JobConfig } from "@ctrlplane/db/schema";
import _ from "lodash";

import type { JobExecutionReason } from "./job-execution.js";
import { createJobExecutions } from "./job-execution.js";
import { dispatchJobExecutionsQueue } from "./queue.js";

export type DispatchFilterFunc = (
  db: Tx,
  jobConfigs: JobConfig[],
) => Promise<JobConfig[]> | JobConfig[];

type ThenFunc = (tx: Tx, jobConfigs: JobConfig[]) => Promise<void>;

class DispatchBuilder {
  private _jobConfigs: JobConfig[];
  private _filters: DispatchFilterFunc[];
  private _then: ThenFunc[];
  private _reason?: JobExecutionReason;

  constructor(private db: Tx) {
    this._jobConfigs = [];
    this._filters = [];
    this._then = [];
  }

  filter(func: DispatchFilterFunc) {
    this._filters.push(func);
    return this;
  }

  jobConfigs(t: JobConfig[]) {
    this._jobConfigs = t;
    return this;
  }

  reason(reason: JobExecutionReason) {
    this._reason = reason;
    return this;
  }

  then(fn: ThenFunc) {
    this._then.push(fn);
    return this;
  }

  async dispatch() {
    let t = this._jobConfigs;
    for (const func of this._filters) t = await func(this.db, t);

    if (t.length === 0) return [];
    const wfs = await createJobExecutions(this.db, t, undefined, this._reason);

    for (const func of this._then) await func(this.db, t);

    await dispatchJobExecutionsQueue.addBulk(
      wfs.map((wf) => ({
        name: wf.id,
        data: {
          jobExecutionId: wf.id,
        },
      })),
    );

    return wfs;
  }
}

export const dispatchJobConfigs = (db: Tx) => new DispatchBuilder(db);
