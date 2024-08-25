import { CronJob } from "cron";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  targetProvider,
  targetProviderGoogle,
  workspace,
} from "@ctrlplane/db/schema";

import { getGkeTargets } from "./google";
import { upsertTargets } from "./targets";

const run = async () => {
  console.log("Running managed providers");

  const googleProviders = await db
    .select()
    .from(targetProvider)
    .innerJoin(workspace, eq(targetProvider.workspaceId, workspace.id))
    .innerJoin(
      targetProviderGoogle,
      eq(targetProvider.id, targetProviderGoogle.targetProviderId),
    );

  for (const provider of googleProviders) {
    console.log("Syncing provider", provider.target_provider.name);
    const targets = await getGkeTargets(
      provider.target_provider.workspaceId,
      provider.target_provider_google,
      provider.workspace.googleServiceAccountEmail,
    );
    await upsertTargets(db, provider.workspace.id, targets);
  }
};

const job = new CronJob("* * * * *", run);

console.log("Starting managed providers cronjob");
run();
job.start();
