import type { Job, JobAgent } from "@ctrlplane/db/schema";

export interface JobQueue {
  /**
   * Enqueues jobs for a specific agent.
   * @param agentId The ID of the agent.
   * @param jobs Array of jobs to add to the queue.
   * @returns A promise that resolves when the task is successfully enqueued.
   */
  enqueue(agentId: JobAgent["id"], jobs: Job[]): void;

  /**
   * Acknowledge the processing of a task.
   * @param jobExcutionId The ID of the message/task to be acknowledged.
   * @returns A promise that resolves when the task is successfully acknowledged.
   */
  acknowledge(jobExcutionId: Job["id"]): Promise<void>;

  /**
   * Retrieve the next jobs ready to be processed for a specific agent. it
   * should return the latest in the queue that has not been served.
   * @param agentId The ID of the agent agent.
   * @returns A promise that resolves with the next jobs
   */
  next(agentId: string): Promise<Job[]>;
}
