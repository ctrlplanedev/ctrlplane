import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

export type PolicyResults = {
  envTargetVersionDecision?: WorkspaceEngine["schemas"]["DeployDecision"];
  envVersionDecision?: WorkspaceEngine["schemas"]["DeployDecision"];
  policiesEvaluated?: number;
  versionDecision?: WorkspaceEngine["schemas"]["DeployDecision"];
  workspaceDecision?: WorkspaceEngine["schemas"]["DeployDecision"];
};
