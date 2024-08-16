import type { Tx } from "@ctrlplane/db";
import type { JobExecution } from "@ctrlplane/db/schema";

import { and, eq, isNull, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { jobExecution } from "@ctrlplane/db/schema";

import type { JobQueue } from "./queue";

class DatabaseJobQueue implements JobQueue {
  constructor(private db: Tx) {}

  enqueue(_: string, __: JobExecution[]): void {
    // noOp - when we create the excution it pull get pulled
  }

  async acknowledge(_: string): Promise<void> {}

  async next(agentId: string): Promise<JobExecution[]> {
    const jobs = await this.db
      .select()
      .from(jobExecution)
      .where(
        and(
          eq(jobExecution.jobAgentId, agentId),
          notInArray(jobExecution.status, [
            "failure",
            "cancelled",
            "skipped",
            "completed",
            "invalid_job_agent",
          ]),
          isNull(jobExecution.externalRunId),
        ),
      );

    return jobs;
  }
}

export const databaseJobQueue = new DatabaseJobQueue(db);
