import type { Tx } from "@ctrlplane/db";
import type { JobConfig, JobExecution } from "@ctrlplane/db/schema";
import amqp from "amqplib";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull, or } from "@ctrlplane/db";
import {
  deployment,
  environment,
  jobAgent,
  jobConfig,
  jobExecution,
  release,
  runbook,
  target,
} from "@ctrlplane/db/schema";

import type { JobExecutionReason } from "./job-execution.js";
import { env } from "./config.js";
import {
  createJobExecutions,
  jobExecutionDataMapper,
} from "./job-execution.js";

/**
 * @deprecated Moving away from using a queue for dispatching jobExecutions.
 */
const dispatchToAmqp = async (db: Tx, jobExecutions: JobExecution[]) => {
  if (jobExecutions.length === 0) return;

  const dispatchData = await db
    .select()
    .from(jobExecution)
    .innerJoin(jobConfig, eq(jobExecution.jobConfigId, jobConfig.id))
    .leftJoin(environment, eq(jobConfig.environmentId, environment.id))
    .leftJoin(target, eq(jobConfig.targetId, target.id))
    .leftJoin(release, eq(jobConfig.releaseId, release.id))
    .leftJoin(runbook, eq(jobConfig.runbookId, runbook.id))
    .leftJoin(deployment, eq(release.deploymentId, deployment.id))
    .innerJoin(
      jobAgent,
      or(
        eq(jobExecution.jobAgentId, jobAgent.id),
        eq(runbook.jobAgentId, jobAgent.id),
      ),
    )
    .where(
      and(
        inArray(
          jobExecution.id,
          jobExecutions.map((d) => d.id),
        ),
        isNull(environment.deletedAt),
      ),
    )
    .then((ds) => ds.map(jobExecutionDataMapper));

  const connection = await amqp.connect(env.AMQP_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(env.AMQP_QUEUE, { durable: true });
  for (const d of dispatchData) {
    const data = Buffer.from(JSON.stringify(d));
    channel.sendToQueue(env.AMQP_QUEUE, data, {
      persistent: true,
      messageId: d.id,
    });
  }

  await channel.close();
};

export const dispatchRunbookJobConfigs = async (
  db: Tx,
  jobConfigs: JobConfig[],
) => {
  const runbooks = jobConfigs.filter((t) => isPresent(t.runbookId));
  const wf = await createJobExecutions(db, runbooks);

  await dispatchToAmqp(db, wf);
};

export const dispatchAllJobConfigs = async (
  db: Tx,
  jobConfigs: JobConfig[],
) => {
  const wf = await createJobExecutions(db, jobConfigs);
  await dispatchToAmqp(db, wf);
};

export type DispatchFilterFunc = (
  db: Tx,
  jobConfigs: JobConfig[],
) => Promise<JobConfig[]>;

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
    await dispatchToAmqp(this.db, wfs);

    for (const func of this._then) await func(this.db, t);

    return wfs;
  }
}

export const dispatchJobConfigs = (db: Tx) => new DispatchBuilder(db);
