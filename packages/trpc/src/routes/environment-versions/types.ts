import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

export type DeploymentVersion = WorkspaceEngine["schemas"]["DeploymentVersion"];
export type ReleaseTarget =
  WorkspaceEngine["schemas"]["ReleaseTargetWithState"];
export type PolicyEvaluation = WorkspaceEngine["schemas"]["PolicyEvaluation"];

export type PolicyResults = {
  envTargetVersionDecision?: WorkspaceEngine["schemas"]["DeployDecision"];
  envVersionDecision?: WorkspaceEngine["schemas"]["DeployDecision"];
  policiesEvaluated?: number;
  versionDecision?: WorkspaceEngine["schemas"]["DeployDecision"];
  workspaceDecision?: WorkspaceEngine["schemas"]["DeployDecision"];
};
