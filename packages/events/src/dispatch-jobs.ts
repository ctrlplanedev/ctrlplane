import type * as schema from "@ctrlplane/db/schema";
import type {
  ReleaseTargetIdentifier,
  VersionEvaluateOptions,
} from "@ctrlplane/rule-engine";
import _ from "lodash";

import type { EventDispatcher, FullPolicy } from "./event-dispatcher.js";
import { Channel, getQueue } from "./index.js";

const dispatchUpdatedResourceJob = async (resources: schema.Resource[]) => {
  const q = getQueue(Channel.UpdatedResource);
  const waiting = await q.getWaiting();
  const waitingIds = new Set(waiting.map((job) => job.data.id));
  const resourcesNotAlreadyQueued = resources.filter(
    (resource) => !waitingIds.has(resource.id),
  );

  const insertJobs = resourcesNotAlreadyQueued.map((r) => ({
    name: r.id,
    data: r,
  }));
  await q.addBulk(insertJobs);
};

const dispatchEvaluateJobs = async (
  rts: ReleaseTargetIdentifier[],
  opts?: {
    skipDuplicateCheck?: boolean;
    versionEvaluateOptions?: VersionEvaluateOptions;
  },
) => {
  const q = getQueue(Channel.EvaluateReleaseTarget);
  const waiting = await q.getWaiting();
  const rtsToEvaluate = rts.filter(
    (rt) =>
      !waiting.some(
        (job) =>
          job.data.deploymentId === rt.deploymentId &&
          job.data.environmentId === rt.environmentId &&
          job.data.resourceId === rt.resourceId,
      ),
  );

  for (const rt of rtsToEvaluate)
    await q.add(`${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`, {
      ...rt,
      ...opts,
    });
};

const dispatchComputeDeploymentResourceSelectorJobs = async (
  deployment: schema.Deployment,
) => {
  const { id } = deployment;
  const q = getQueue(Channel.ComputeDeploymentResourceSelector);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some((job) => job.data.id === id);
  if (isAlreadyQueued) return;
  await q.add(id, deployment);
};

const dispatchComputeEnvironmentResourceSelectorJobs = async (
  environment: schema.Environment,
) => {
  const { id } = environment;
  const q = getQueue(Channel.ComputeEnvironmentResourceSelector);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some((job) => job.data.id === id);
  if (isAlreadyQueued) return;
  await q.add(id, environment);
};

const dispatchComputePolicyTargetReleaseTargetSelectorJobs = async (
  policyTarget: schema.PolicyTarget,
) => {
  const { id } = policyTarget;
  const q = getQueue(Channel.ComputePolicyTargetReleaseTargetSelector);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some((job) => job.data.id === id);
  if (isAlreadyQueued) return;
  await q.add(id, policyTarget);
};

const dispatchComputeSystemReleaseTargetsJobs = async (
  system: schema.System,
) => {
  const { id } = system;
  const q = getQueue(Channel.ComputeSystemsReleaseTargets);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some((job) => job.data.id === id);
  if (isAlreadyQueued) return;
  await q.add(id, { id });
};

const dispatchComputeWorkspacePolicyTargetsJobs = async (
  workspaceId: string,
  releaseTargetsToEvaluate?: schema.ReleaseTarget[],
) => {
  const q = getQueue(Channel.ComputeWorkspacePolicyTargets);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some(
    (job) =>
      job.data.workspaceId === workspaceId &&
      _.isEqual(job.data.releaseTargetsToEvaluate, releaseTargetsToEvaluate),
  );
  if (isAlreadyQueued) return;
  await q.add(workspaceId, {
    workspaceId,
    releaseTargetsToEvaluate,
  });
};

const toEvaluate = () => ({
  releaseTargets: (
    releaseTargets: ReleaseTargetIdentifier[],
    opts?: {
      skipDuplicateCheck?: boolean;
      versionEvaluateOptions?: VersionEvaluateOptions;
    },
  ) => dispatchEvaluateJobs(releaseTargets, opts),
});

const toCompute = () => ({
  deployment: (deployment: schema.Deployment) => ({
    resourceSelector: () =>
      dispatchComputeDeploymentResourceSelectorJobs(deployment),
  }),
  environment: (environment: schema.Environment) => ({
    resourceSelector: () =>
      dispatchComputeEnvironmentResourceSelectorJobs(environment),
  }),
  policyTarget: (policyTarget: schema.PolicyTarget) => ({
    releaseTargetSelector: () =>
      dispatchComputePolicyTargetReleaseTargetSelectorJobs(policyTarget),
  }),
  system: (system: schema.System) => ({
    releaseTargets: () => dispatchComputeSystemReleaseTargetsJobs(system),
  }),
  workspace: (workspaceId: string) => ({
    policyTargets: (opts?: {
      releaseTargetsToEvaluate?: schema.ReleaseTarget[];
    }) =>
      dispatchComputeWorkspacePolicyTargetsJobs(
        workspaceId,
        opts?.releaseTargetsToEvaluate,
      ),
  }),
});

const toDispatch = () => ({
  ctrlplaneJob: (jobId: string) =>
    getQueue(Channel.DispatchJob).add(jobId, {
      jobId,
    }),
});

export const dispatchQueueJob = () => ({
  toUpdatedResource: dispatchUpdatedResourceJob,
  toEvaluate,
  toCompute,
  toDispatch,
});

export class BullMQEventDispatcher implements EventDispatcher {
  async dispatchSystemCreated(_: schema.System): Promise<void> {
    return Promise.resolve();
  }

  async dispatchSystemUpdated(_: schema.System): Promise<void> {
    return Promise.resolve();
  }

  async dispatchSystemDeleted(_: schema.System): Promise<void> {
    return Promise.resolve();
  }

  async dispatchResourceCreated(resource: schema.Resource): Promise<void> {
    await getQueue(Channel.NewResource).add(resource.id, resource);
  }

  async dispatchResourceUpdated(
    _: schema.Resource,
    current: schema.Resource,
  ): Promise<void> {
    const q = getQueue(Channel.UpdatedResource);
    const waiting = await q.getWaiting();
    const waitingIds = new Set(waiting.map((job) => job.data.id));
    const isAlreadyQueued = waitingIds.has(current.id);
    if (isAlreadyQueued) return;
    await q.add(current.id, current);
  }

  async dispatchResourceDeleted(resource: schema.Resource): Promise<void> {
    await getQueue(Channel.DeleteResource).add(resource.id, resource);
  }

  async dispatchResourceVariableCreated(
    resourceVariable: typeof schema.resourceVariable.$inferSelect,
  ): Promise<void> {
    await getQueue(Channel.UpdateResourceVariable).add(
      resourceVariable.id,
      resourceVariable,
    );
  }

  async dispatchResourceVariableUpdated(
    _: typeof schema.resourceVariable.$inferSelect,
    current: typeof schema.resourceVariable.$inferSelect,
  ): Promise<void> {
    await getQueue(Channel.UpdateResourceVariable).add(current.id, current);
  }

  async dispatchResourceVariableDeleted(
    _: typeof schema.resourceVariable.$inferSelect,
  ): Promise<void> {
    await Promise.resolve();
  }

  async dispatchEnvironmentCreated(
    environment: schema.Environment,
  ): Promise<void> {
    await getQueue(Channel.NewEnvironment).add(environment.id, environment);
  }

  async dispatchEnvironmentUpdated(
    previous: schema.Environment,
    current: schema.Environment,
  ): Promise<void> {
    await getQueue(Channel.UpdateEnvironment).add(current.id, {
      ...current,
      oldSelector: previous.resourceSelector,
    });
  }

  async dispatchEnvironmentDeleted(
    environment: schema.Environment,
  ): Promise<void> {
    await getQueue(Channel.DeleteEnvironment).add(environment.id, environment);
  }

  async dispatchDeploymentCreated(
    deployment: schema.Deployment,
  ): Promise<void> {
    await getQueue(Channel.NewDeployment).add(deployment.id, deployment);
  }

  async dispatchDeploymentUpdated(
    previous: schema.Deployment,
    current: schema.Deployment,
  ): Promise<void> {
    await getQueue(Channel.UpdateDeployment).add(current.id, {
      new: current,
      old: previous,
    });
  }

  async dispatchDeploymentDeleted(
    deployment: schema.Deployment,
  ): Promise<void> {
    await getQueue(Channel.DeleteDeployment).add(deployment.id, deployment);
  }

  async dispatchDeploymentVersionCreated(
    deploymentVersion: schema.DeploymentVersion,
  ): Promise<void> {
    await getQueue(Channel.NewDeploymentVersion).add(
      deploymentVersion.id,
      deploymentVersion,
    );
  }

  async dispatchDeploymentVersionUpdated(
    _: schema.DeploymentVersion,
    current: schema.DeploymentVersion,
  ): Promise<void> {
    await getQueue(Channel.NewDeploymentVersion).add(current.id, current);
  }

  async dispatchDeploymentVersionDeleted(
    _: schema.DeploymentVersion,
  ): Promise<void> {
    await Promise.resolve();
  }

  async dispatchDeploymentVariableCreated(
    deploymentVariable: schema.DeploymentVariable,
  ): Promise<void> {
    await getQueue(Channel.UpdateDeploymentVariable).add(
      deploymentVariable.id,
      deploymentVariable,
    );
  }

  async dispatchDeploymentVariableUpdated(
    _: schema.DeploymentVariable,
    current: schema.DeploymentVariable,
  ): Promise<void> {
    await getQueue(Channel.UpdateDeploymentVariable).add(current.id, current);
  }

  async dispatchDeploymentVariableValueCreated(
    _: schema.DeploymentVariableValue,
  ): Promise<void> {
    await Promise.resolve();
  }

  async dispatchDeploymentVariableValueUpdated(
    _: schema.DeploymentVariableValue,
    __: schema.DeploymentVariableValue,
  ): Promise<void> {
    await Promise.resolve();
  }

  async dispatchDeploymentVariableValueDeleted(
    _: schema.DeploymentVariableValue,
  ): Promise<void> {
    await Promise.resolve();
  }

  async dispatchDeploymentVariableDeleted(
    _: schema.DeploymentVariable,
  ): Promise<void> {
    await Promise.resolve();
  }

  async dispatchJobAgentCreated(_: schema.JobAgent): Promise<void> {
    return Promise.resolve();
  }
  async dispatchJobAgentUpdated(_: schema.JobAgent): Promise<void> {
    return Promise.resolve();
  }

  async dispatchJobAgentDeleted(_: schema.JobAgent): Promise<void> {
    return Promise.resolve();
  }

  async dispatchPolicyCreated(policy: FullPolicy): Promise<void> {
    await getQueue(Channel.NewPolicy).add(policy.id, policy);
  }

  async dispatchPolicyUpdated(
    _: FullPolicy,
    current: FullPolicy,
  ): Promise<void> {
    await getQueue(Channel.UpdatePolicy).add(current.id, current);
  }

  async dispatchPolicyDeleted(_: FullPolicy): Promise<void> {
    await Promise.resolve();
  }

  async dispatchJobUpdated(
    _: schema.Job & { metadata?: Record<string, any> },
    current: schema.Job & { metadata?: Record<string, any> },
  ): Promise<void> {
    await getQueue(Channel.UpdateJob).add(current.id, {
      jobId: current.id,
      data: current,
      metadata: current.metadata,
    });
  }

  async dispatchEvaluateReleaseTarget(
    releaseTarget: schema.ReleaseTarget,
    opts?: { skipDuplicateCheck?: boolean },
  ): Promise<void> {
    const q = getQueue(Channel.EvaluateReleaseTarget);
    const waiting = await q.getWaiting();
    const isAlreadyQueued = waiting.some(
      (job) =>
        job.data.environmentId === releaseTarget.environmentId &&
        job.data.resourceId === releaseTarget.resourceId &&
        job.data.deploymentId === releaseTarget.deploymentId,
    );
    if (isAlreadyQueued) return;
    await q.add(releaseTarget.id, {
      environmentId: releaseTarget.environmentId,
      resourceId: releaseTarget.resourceId,
      deploymentId: releaseTarget.deploymentId,
      skipDuplicateCheck: opts?.skipDuplicateCheck,
    });
  }

  async dispatchUserApprovalRecordCreated(
    _: schema.PolicyRuleAnyApprovalRecord,
  ): Promise<void> {
    return Promise.resolve();
  }

  async dispatchUserApprovalRecordUpdated(
    _: schema.PolicyRuleAnyApprovalRecord,
  ): Promise<void> {
    return Promise.resolve();
  }

  async dispatchUserApprovalRecordDeleted(
    _: schema.PolicyRuleAnyApprovalRecord,
  ): Promise<void> {
    return Promise.resolve();
  }
}
