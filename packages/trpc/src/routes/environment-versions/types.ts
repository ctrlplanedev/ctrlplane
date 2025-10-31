import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

export type DeploymentVersion = WorkspaceEngine["schemas"]["DeploymentVersion"];
export type ReleaseTarget =
  WorkspaceEngine["schemas"]["ReleaseTargetWithState"];
export type PolicyEvaluation = WorkspaceEngine["schemas"]["PolicyEvaluation"];
export type Policy = WorkspaceEngine["schemas"]["Policy"];
export type RuleEvaluation = WorkspaceEngine["schemas"]["RuleEvaluation"];

export type ReleaseTargetEvaluation = {
  decision?: WorkspaceEngine["schemas"]["DeployDecision"];
  policiesEvaluated?: number;
};
export type ReleaseTargetWithEval = {
  target: ReleaseTarget;
  evaluation: ReleaseTargetEvaluation;
};

export type PolicyResults = {
  decision?: WorkspaceEngine["schemas"]["DeployDecision"];
  policiesEvaluated?: number;
};
