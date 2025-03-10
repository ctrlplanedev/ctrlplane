import type { Tx } from "@ctrlplane/db";
import type { Job } from "@ctrlplane/db/schema";

import { and, eq, isNull, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { job } from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { JobQueue } from "./queue";

class DatabaseJobQueue implements JobQueue {
  constructor(private db: Tx) {}

  enqueue(_: string, __: Job[]): void {
    // noOp - when we create the excution it pull get pulled
  }

  async acknowledge(_: string): Promise<void> {}

  async next(agentId: string): Promise<Job[]> {
    const jobs = await this.db
      .select()
      .from(job)
      .where(
        and(
          eq(job.jobAgentId, agentId),
          notInArray(job.status, [
            JobStatus.Failure,
            JobStatus.Cancelled,
            JobStatus.Skipped,
            JobStatus.Successful,
            JobStatus.InvalidJobAgent,
          ]),
          isNull(job.externalId),
        ),
      );

    return jobs;
  }
}

export const databaseJobQueue = new DatabaseJobQueue(db);
