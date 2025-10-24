import type * as schema from "@ctrlplane/db/schema";

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

export interface EventDispatcher {
  dispatchSystemCreated(system: schema.System): Promise<void>;
  dispatchSystemUpdated(system: schema.System): Promise<void>;
  dispatchSystemDeleted(system: schema.System): Promise<void>;

  dispatchResourceCreated(resource: schema.Resource): Promise<void>;
  dispatchResourceUpdated(
    previous: schema.Resource,
    current: schema.Resource,
  ): Promise<void>;
  dispatchResourceDeleted(resource: schema.Resource): Promise<void>;

  dispatchResourceVariableCreated(
    resourceVariable: typeof schema.resourceVariable.$inferSelect,
  ): Promise<void>;
  dispatchResourceVariableUpdated(
    previous: typeof schema.resourceVariable.$inferSelect,
    current: typeof schema.resourceVariable.$inferSelect,
  ): Promise<void>;
  dispatchResourceVariableDeleted(
    resourceVariable: typeof schema.resourceVariable.$inferSelect,
  ): Promise<void>;

  dispatchEnvironmentCreated(environment: schema.Environment): Promise<void>;
  dispatchEnvironmentUpdated(
    previous: schema.Environment,
    current: schema.Environment,
  ): Promise<void>;
  dispatchEnvironmentDeleted(environment: schema.Environment): Promise<void>;

  dispatchDeploymentCreated(deployment: schema.Deployment): Promise<void>;
  dispatchDeploymentUpdated(
    previous: schema.Deployment,
    current: schema.Deployment,
  ): Promise<void>;
  dispatchDeploymentDeleted(deployment: schema.Deployment): Promise<void>;

  dispatchDeploymentVersionCreated(
    deploymentVersion: schema.DeploymentVersion,
  ): Promise<void>;
  dispatchDeploymentVersionUpdated(
    previous: schema.DeploymentVersion,
    current: schema.DeploymentVersion,
  ): Promise<void>;
  dispatchDeploymentVersionDeleted(
    deploymentVersion: schema.DeploymentVersion,
  ): Promise<void>;

  dispatchDeploymentVariableCreated(
    deploymentVariable: schema.DeploymentVariable,
  ): Promise<void>;
  dispatchDeploymentVariableUpdated(
    previous: schema.DeploymentVariable,
    current: schema.DeploymentVariable,
  ): Promise<void>;
  dispatchDeploymentVariableDeleted(
    deploymentVariable: schema.DeploymentVariable,
  ): Promise<void>;

  dispatchDeploymentVariableValueCreated(
    deploymentVariableValue: schema.DeploymentVariableValue,
  ): Promise<void>;
  dispatchDeploymentVariableValueUpdated(
    previous: schema.DeploymentVariableValue,
    current: schema.DeploymentVariableValue,
  ): Promise<void>;
  dispatchDeploymentVariableValueDeleted(
    deploymentVariableValue: schema.DeploymentVariableValue,
  ): Promise<void>;

  dispatchJobAgentCreated(jobAgent: schema.JobAgent): Promise<void>;
  dispatchJobAgentUpdated(jobAgent: schema.JobAgent): Promise<void>;
  dispatchJobAgentDeleted(jobAgent: schema.JobAgent): Promise<void>;

  dispatchPolicyCreated(policy: FullPolicy): Promise<void>;
  dispatchPolicyUpdated(
    previous: FullPolicy,
    current: FullPolicy,
  ): Promise<void>;
  dispatchPolicyDeleted(policy: FullPolicy): Promise<void>;

  dispatchJobUpdated(
    previous: schema.Job & { metadata?: Record<string, any> },
    current: schema.Job & { metadata?: Record<string, any> },
  ): Promise<void>;

  dispatchEvaluateReleaseTarget(
    releaseTarget: schema.ReleaseTarget,
    opts?: { skipDuplicateCheck?: boolean },
  ): Promise<void>;

  dispatchRedeploy(releaseTargetId: string): Promise<void>;

  dispatchUserApprovalRecordCreated(
    userApprovalRecord: schema.PolicyRuleAnyApprovalRecord,
  ): Promise<void>;
  dispatchUserApprovalRecordUpdated(
    userApprovalRecord: schema.PolicyRuleAnyApprovalRecord,
  ): Promise<void>;
  dispatchUserApprovalRecordDeleted(
    userApprovalRecord: schema.PolicyRuleAnyApprovalRecord,
  ): Promise<void>;

  dispatchGithubEntityCreated(githubEntity: schema.GithubEntity): Promise<void>;
  dispatchGithubEntityUpdated(githubEntity: schema.GithubEntity): Promise<void>;
  dispatchGithubEntityDeleted(githubEntity: schema.GithubEntity): Promise<void>;
}
