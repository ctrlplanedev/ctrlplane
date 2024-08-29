import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { JobExecution, jobExecution } from "@ctrlplane/db/schema";

import { configSchema, convertStatus, getOctokit } from "../github-utils";

export const syncGithubJobExecution = async (je: JobExecution) => {
  const config = je.jobAgentConfig;
  configSchema.parse(config);

  const octokit = getOctokit();
  if (octokit == null) throw new Error("GitHub bot not configured");

  const runId = await pRetry(
    async () => {
      const runs = await octokit.actions.listWorkflowRuns({
        owner: config.login,
        repo: config.repo,
        workflow_id: config.workflowId,
      });

      const run = runs.data.workflow_runs.find((run) =>
        run.name?.includes(je.id.slice(0, 8)),
      );

      return run?.id;
    },
    { retries: 15, minTimeout: 1000 },
  );

  if (runId == null) {
    console.error(`Run ID not found for job execution ${jobExecution.id}`);
    return;
  }

  const { data: workflowState } = await octokit.actions.getWorkflowRun({
    owner: config.login,
    repo: config.repo,
    run_id: runId,
  });

  const status = convertStatus(workflowState.status ?? "pending");

  await db
    .update(jobExecution)
    .set({ status })
    .where(eq(jobExecution.id, je.id));

  return status === "completed";
};
function pRetry(
  arg0: () => Promise<number | undefined>,
  arg1: { retries: number; minTimeout: number },
) {
  throw new Error("Function not implemented.");
}
