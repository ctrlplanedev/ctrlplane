// import type { JobExecution } from "@ctrlplane/db/schema";
// import type { RedisClientType } from "redis";
// import { createClient } from "redis";

// import type { JobQueue } from "./queue";

// export class RedisService implements JobQueue {
//   private client: RedisClientType;

//   constructor() {
//     this.client = createClient();
//     this.client.connect();
//   }

//   async enqueue(agentId: string, jobs: JobExecution[]): Promise<void> {
//     const queueKey = `agent:${agentId}:queue`;
//     const pipeline = this.client.multi();
//     for (const job of jobs) pipeline.lPush(queueKey, JSON.stringify(job));
//     await pipeline.exec();
//   }

//   acknowledge(agentId: string, jobExcutionId: string): Promise<void> {
//     throw new Error("Method not implemented.");
//   }

//   next(agentId: string): Promise<JobExecution[]> {
//     throw new Error("Method not implemented.");
//   }
// }
