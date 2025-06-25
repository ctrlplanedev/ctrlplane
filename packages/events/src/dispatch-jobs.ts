import type * as schema from "@ctrlplane/db/schema";
import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";
import _ from "lodash";

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
    evaluationRequestedById?: string;
  },
) => {
  const { skipDuplicateCheck, evaluationRequestedById } = opts ?? {};
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
      evaluationRequestedById,
      skipDuplicateCheck,
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
  processedPolicyTargetIds?: string[],
  releaseTargetsToEvaluate?: ReleaseTargetIdentifier[],
) => {
  const q = getQueue(Channel.ComputeWorkspacePolicyTargets);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some(
    (job) =>
      job.data.workspaceId === workspaceId &&
      _.isEqual(job.data.releaseTargetsToEvaluate, releaseTargetsToEvaluate) &&
      _.isEqual(job.data.processedPolicyTargetIds, processedPolicyTargetIds),
  );
  if (isAlreadyQueued) return;
  await q.add(workspaceId, {
    workspaceId,
    processedPolicyTargetIds,
    releaseTargetsToEvaluate,
  });
};

const toEvaluate = () => ({
  releaseTargets: (
    releaseTargets: ReleaseTargetIdentifier[],
    opts?: {
      skipDuplicateCheck?: boolean;
      evaluationRequestedById?: string;
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
      processedPolicyTargetIds?: string[];
      releaseTargetsToEvaluate?: ReleaseTargetIdentifier[];
    }) =>
      dispatchComputeWorkspacePolicyTargetsJobs(
        workspaceId,
        opts?.processedPolicyTargetIds,
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
