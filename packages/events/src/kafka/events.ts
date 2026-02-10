import type * as schema from "@ctrlplane/db/schema";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

export enum Event {
  WorkspaceSave = "workspace.save",

  SystemCreated = "system.created",
  SystemUpdated = "system.updated",
  SystemDeleted = "system.deleted",

  ResourceCreated = "resource.created",
  ResourceUpdated = "resource.updated",
  ResourceDeleted = "resource.deleted",

  ResourceVariableCreated = "resource-variable.created",
  ResourceVariableUpdated = "resource-variable.updated",
  ResourceVariableDeleted = "resource-variable.deleted",
  ResourceVariablesBulkUpdated = "resource-variables.bulk-updated",

  DeploymentCreated = "deployment.created",
  DeploymentUpdated = "deployment.updated",
  DeploymentDeleted = "deployment.deleted",

  DeploymentVariableCreated = "deployment-variable.created",
  DeploymentVariableUpdated = "deployment-variable.updated",
  DeploymentVariableDeleted = "deployment-variable.deleted",

  DeploymentVariableValueCreated = "deployment-variable-value.created",
  DeploymentVariableValueUpdated = "deployment-variable-value.updated",
  DeploymentVariableValueDeleted = "deployment-variable-value.deleted",

  DeploymentVersionCreated = "deployment-version.created",
  DeploymentVersionUpdated = "deployment-version.updated",
  DeploymentVersionDeleted = "deployment-version.deleted",

  JobAgentCreated = "job-agent.created",
  JobAgentUpdated = "job-agent.updated",
  JobAgentDeleted = "job-agent.deleted",

  EnvironmentCreated = "environment.created",
  EnvironmentUpdated = "environment.updated",
  EnvironmentDeleted = "environment.deleted",

  PolicyCreated = "policy.created",
  PolicyUpdated = "policy.updated",
  PolicyDeleted = "policy.deleted",

  PolicySkipCreated = "policy-skip.created",
  PolicySkipDeleted = "policy-skip.deleted",

  RelationshipRuleCreated = "relationship-rule.created",
  RelationshipRuleUpdated = "relationship-rule.updated",
  RelationshipRuleDeleted = "relationship-rule.deleted",

  // JobCreated = "job.created",
  JobUpdated = "job.updated",
  // JobDeleted = "job.deleted",
  EvaluateReleaseTarget = "evaluate-release-target",

  UserApprovalRecordCreated = "user-approval-record.created",
  UserApprovalRecordUpdated = "user-approval-record.updated",
  UserApprovalRecordDeleted = "user-approval-record.deleted",

  GithubEntityCreated = "github-entity.created",
  GithubEntityUpdated = "github-entity.updated",
  GithubEntityDeleted = "github-entity.deleted",

  Redeploy = "release-target.deploy",

  ResourceProviderSetResources = "resource-provider.set-resources",

  WorkflowTemplateCreated = "workflow-template.created",
  WorkflowTemplateUpdated = "workflow-template.updated",
  WorkflowTemplateDeleted = "workflow-template.deleted",
  WorkflowCreated = "workflow.created",
}

export type FullPolicy = schema.Policy & {
  targets: schema.PolicyTarget[];
  denyWindows: schema.PolicyRuleDenyWindow[];
  deploymentVersionSelector: schema.PolicyDeploymentVersionSelector | null;
  versionAnyApprovals: schema.PolicyRuleAnyApproval | null;
  versionUserApprovals: schema.PolicyRuleUserApproval[];
  versionRoleApprovals: schema.PolicyRuleRoleApproval[];
  concurrency: schema.PolicyRuleConcurrency | null;
  environmentVersionRollout: schema.PolicyRuleEnvironmentVersionRollout | null;
  maxRetries: schema.PolicyRuleMaxRetries | null;
};

export type FullResource = schema.Resource & {
  metadata: Record<string, string>;
};

export type FullReleaseTarget = schema.ReleaseTarget & {
  resource: FullResource;
  environment: schema.Environment;
  deployment: schema.Deployment;
};

export type GoEventPayload = {
  [Event.WorkspaceSave]: object;
  [Event.SystemCreated]: WorkspaceEngine["schemas"]["System"];
  [Event.SystemUpdated]: WorkspaceEngine["schemas"]["System"];
  [Event.SystemDeleted]: WorkspaceEngine["schemas"]["System"];
  [Event.ResourceCreated]: WorkspaceEngine["schemas"]["Resource"];
  [Event.ResourceUpdated]: WorkspaceEngine["schemas"]["Resource"];
  [Event.ResourceDeleted]: WorkspaceEngine["schemas"]["Resource"];
  [Event.ResourceVariableCreated]: WorkspaceEngine["schemas"]["ResourceVariable"];
  [Event.DeploymentCreated]: WorkspaceEngine["schemas"]["Deployment"];
  [Event.DeploymentUpdated]: WorkspaceEngine["schemas"]["Deployment"];
  [Event.DeploymentDeleted]: WorkspaceEngine["schemas"]["Deployment"];
  [Event.DeploymentVariableCreated]: WorkspaceEngine["schemas"]["DeploymentVariable"];
  [Event.DeploymentVariableUpdated]: WorkspaceEngine["schemas"]["DeploymentVariable"];
  [Event.DeploymentVariableDeleted]: WorkspaceEngine["schemas"]["DeploymentVariable"];
  [Event.DeploymentVariableValueCreated]: WorkspaceEngine["schemas"]["DeploymentVariableValue"];
  [Event.DeploymentVariableValueUpdated]: WorkspaceEngine["schemas"]["DeploymentVariableValue"];
  [Event.DeploymentVariableValueDeleted]: WorkspaceEngine["schemas"]["DeploymentVariableValue"];
  [Event.DeploymentVersionCreated]: WorkspaceEngine["schemas"]["DeploymentVersion"];
  [Event.DeploymentVersionUpdated]: WorkspaceEngine["schemas"]["DeploymentVersion"];
  [Event.DeploymentVersionDeleted]: WorkspaceEngine["schemas"]["DeploymentVersion"];
  [Event.JobAgentCreated]: WorkspaceEngine["schemas"]["JobAgent"];
  [Event.JobAgentUpdated]: WorkspaceEngine["schemas"]["JobAgent"];
  [Event.JobAgentDeleted]: WorkspaceEngine["schemas"]["JobAgent"];
  [Event.EnvironmentCreated]: WorkspaceEngine["schemas"]["Environment"];
  [Event.EnvironmentUpdated]: WorkspaceEngine["schemas"]["Environment"];
  [Event.EnvironmentDeleted]: WorkspaceEngine["schemas"]["Environment"];
  [Event.PolicyCreated]: WorkspaceEngine["schemas"]["Policy"];
  [Event.PolicyUpdated]: WorkspaceEngine["schemas"]["Policy"];
  [Event.PolicyDeleted]: WorkspaceEngine["schemas"]["Policy"];
  [Event.PolicySkipCreated]: WorkspaceEngine["schemas"]["PolicySkip"];
  [Event.PolicySkipDeleted]: WorkspaceEngine["schemas"]["PolicySkip"];
  [Event.JobUpdated]: WorkspaceEngine["schemas"]["JobUpdateEvent"];
  [Event.ResourceVariablesBulkUpdated]: WorkspaceEngine["schemas"]["ResourceVariablesBulkUpdateEvent"];
  [Event.UserApprovalRecordCreated]: WorkspaceEngine["schemas"]["UserApprovalRecord"];
  [Event.UserApprovalRecordUpdated]: WorkspaceEngine["schemas"]["UserApprovalRecord"];
  [Event.UserApprovalRecordDeleted]: WorkspaceEngine["schemas"]["UserApprovalRecord"];
  [Event.GithubEntityCreated]: WorkspaceEngine["schemas"]["GithubEntity"];
  [Event.GithubEntityUpdated]: WorkspaceEngine["schemas"]["GithubEntity"];
  [Event.GithubEntityDeleted]: WorkspaceEngine["schemas"]["GithubEntity"];
  [Event.RelationshipRuleCreated]: WorkspaceEngine["schemas"]["RelationshipRule"];
  [Event.RelationshipRuleUpdated]: WorkspaceEngine["schemas"]["RelationshipRule"];
  [Event.RelationshipRuleDeleted]: WorkspaceEngine["schemas"]["RelationshipRule"];
  [Event.Redeploy]: WorkspaceEngine["schemas"]["ReleaseTarget"];
  [Event.ResourceProviderSetResources]: {
    providerId: string;
    batchId: string;
  };
  [Event.WorkflowTemplateCreated]: WorkspaceEngine["schemas"]["WorkflowTemplate"];
  [Event.WorkflowTemplateUpdated]: WorkspaceEngine["schemas"]["WorkflowTemplate"];
  [Event.WorkflowTemplateDeleted]: WorkspaceEngine["schemas"]["WorkflowTemplate"];
  [Event.WorkflowCreated]: WorkspaceEngine["schemas"]["Workflow"];
};

export type GoMessage<T extends keyof GoEventPayload> = {
  workspaceId: string;
  eventType: T;
  data: GoEventPayload[T];
  timestamp: number;
};
