import type * as schema from "@ctrlplane/db/schema";

export enum Channel {
  JobSync = "job-sync",
  DispatchJob = "dispatch-job",
  ResourceScan = "resource-scan",

  ReleaseNewVersion = "release-new-version",
  ReleaseNewRepository = "release-new-repository",
  ReleaseVariableChange = "release-variable-change",

  NewDeployment = "new-deployment",
  NewEnvironment = "new-environment",
  NewRelease = "new-release",
  ReleaseEvaluate = "release-evaluate",
}

export type ChannelMap = {
  [Channel.UpsertRelease]: typeof schema.release.$inferInsert;
  [Channel.NewDeployment]: typeof schema.deployment.$inferSelect;
  [Channel.NewEnvironment]: typeof schema.environment.$inferSelect;
  [Channel.ReleaseEvaluate]: typeof schema.resourceRelease.$inferSelect;
};
