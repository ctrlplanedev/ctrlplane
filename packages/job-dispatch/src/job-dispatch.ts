import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq, inArray, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTriggeredRunbookJob } from "./job-creation.js";
import { updateJob } from "./job-update.js";
import { createReleaseVariables } from "./job-variables-deployment/job-variables-deployment.js";
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

    const [wfsWithJobAgent, wfsWithoutJobAgent] = _.partition(
      wfs,
      (wf) => wf.jobAgentId !== null,
    );

    for (const func of this._then) await func(this.db, t);

    console.log(`Dispatching ${wfs.length} jobs to the dispatch queue`);

    const results = await Promise.allSettled(
      wfsWithJobAgent.map((wf) => createReleaseVariables(this.db, wf.id)),
    );

    const jobsWithResolvedVariables = await Promise.all(
      results.map(async (result, index) => {
        if (result.status !== "fulfilled") {
          const wf = wfsWithJobAgent[index];
          if (!wf) return null;

          return updateJob(this.db, wf.id, {
            status: JobStatus.Failure,
            message: `Variable resolution failed during job dispatch: ${result.reason.message}`,
          });
        }
        return wfsWithJobAgent[index];
      }),
    );

    const validJobsWithResolvedVariables = jobsWithResolvedVariables.filter(
      (job): job is schema.Job => job !== null,
    );

    if (validJobsWithResolvedVariables.length > 0) {
      await dispatchJobsQueue.addBulk(
        validJobsWithResolvedVariables.map((wf) => ({
          name: wf.id,
          data: { jobId: wf.id },
        })),
      );

      await Promise.all(
        validJobsWithResolvedVariables.map((j) =>
          updateJob(this.db, j.id, { status: JobStatus.InProgress }),
        ),
      );
    }

    await Promise.all(
      wfsWithoutJobAgent.map((j) =>
        updateJob(this.db, j.id, {
          status: JobStatus.InvalidJobAgent,
          message: "No job agent found",
        }),
      ),
    );

    return validJobsWithResolvedVariables;
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
