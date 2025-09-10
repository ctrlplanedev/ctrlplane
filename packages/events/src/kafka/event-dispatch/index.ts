import type * as schema from "@ctrlplane/db/schema";

import type { EventDispatcher, FullPolicy } from "../../event-dispatcher.js";
import * as deploymentVariableDispatch from "./deployment-variable.js";
import * as deploymentVersionDispatch from "./deployment-version.js";
import * as deploymentDispatch from "./deployment.js";
import * as environmentDispatch from "./environment.js";
import * as jobDispatch from "./job.js";
import * as policyDispatch from "./policy.js";
import * as resourceDispatch from "./resource.js";

export class KafkaEventDispatcher implements EventDispatcher {
  async dispatchResourceCreated(resource: schema.Resource): Promise<void> {
    await resourceDispatch.dispatchResourceCreated(resource);
  }

  async dispatchResourceUpdated(
    previous: schema.Resource,
    current: schema.Resource,
  ): Promise<void> {
    await resourceDispatch.dispatchResourceUpdated(previous, current);
  }

  async dispatchResourceDeleted(resource: schema.Resource): Promise<void> {
    await resourceDispatch.dispatchResourceDeleted(resource);
  }

  dispatchResourceVariableCreated(
    _: typeof schema.resourceVariable.$inferSelect,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  dispatchResourceVariableUpdated(
    _: typeof schema.resourceVariable.$inferSelect,
    __: typeof schema.resourceVariable.$inferSelect,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  dispatchResourceVariableDeleted(
    _: typeof schema.resourceVariable.$inferSelect,
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async dispatchEnvironmentCreated(
    environment: schema.Environment,
  ): Promise<void> {
    await environmentDispatch.dispatchEnvironmentCreated(environment);
  }

  async dispatchEnvironmentUpdated(
    previous: schema.Environment,
    current: schema.Environment,
  ): Promise<void> {
    await environmentDispatch.dispatchEnvironmentUpdated(previous, current);
  }

  async dispatchEnvironmentDeleted(
    environment: schema.Environment,
  ): Promise<void> {
    await environmentDispatch.dispatchEnvironmentDeleted(environment);
  }

  async dispatchDeploymentCreated(
    deployment: schema.Deployment,
  ): Promise<void> {
    await deploymentDispatch.dispatchDeploymentCreated(deployment);
  }

  async dispatchDeploymentUpdated(
    previous: schema.Deployment,
    current: schema.Deployment,
  ): Promise<void> {
    await deploymentDispatch.dispatchDeploymentUpdated(previous, current);
  }

  async dispatchDeploymentDeleted(
    deployment: schema.Deployment,
  ): Promise<void> {
    await deploymentDispatch.dispatchDeploymentDeleted(deployment);
  }

  async dispatchDeploymentVersionCreated(
    deploymentVersion: schema.DeploymentVersion,
  ): Promise<void> {
    await deploymentVersionDispatch.dispatchDeploymentVersionCreated(
      deploymentVersion,
    );
  }

  async dispatchDeploymentVersionUpdated(
    previous: schema.DeploymentVersion,
    current: schema.DeploymentVersion,
  ): Promise<void> {
    await deploymentVersionDispatch.dispatchDeploymentVersionUpdated(
      previous,
      current,
    );
  }

  async dispatchDeploymentVersionDeleted(
    deploymentVersion: schema.DeploymentVersion,
  ): Promise<void> {
    await deploymentVersionDispatch.dispatchDeploymentVersionDeleted(
      deploymentVersion,
    );
  }

  async dispatchDeploymentVariableCreated(
    deploymentVariable: schema.DeploymentVariable,
  ): Promise<void> {
    await deploymentVariableDispatch.dispatchDeploymentVariableCreated(
      deploymentVariable,
    );
  }

  async dispatchDeploymentVariableUpdated(
    previous: schema.DeploymentVariable,
    current: schema.DeploymentVariable,
  ): Promise<void> {
    await deploymentVariableDispatch.dispatchDeploymentVariableUpdated(
      previous,
      current,
    );
  }

  async dispatchDeploymentVariableDeleted(
    deploymentVariable: schema.DeploymentVariable,
  ): Promise<void> {
    await deploymentVariableDispatch.dispatchDeploymentVariableDeleted(
      deploymentVariable,
    );
  }

  async dispatchDeploymentVariableValueCreated(
    deploymentVariableValue: schema.DeploymentVariableValue,
  ): Promise<void> {
    await deploymentVariableDispatch.dispatchDeploymentVariableValueCreated(
      deploymentVariableValue,
    );
  }

  async dispatchDeploymentVariableValueUpdated(
    previous: schema.DeploymentVariableValue,
    current: schema.DeploymentVariableValue,
  ): Promise<void> {
    await deploymentVariableDispatch.dispatchDeploymentVariableValueUpdated(
      previous,
      current,
    );
  }

  async dispatchDeploymentVariableValueDeleted(
    deploymentVariableValue: schema.DeploymentVariableValue,
  ): Promise<void> {
    await deploymentVariableDispatch.dispatchDeploymentVariableValueDeleted(
      deploymentVariableValue,
    );
  }

  async dispatchPolicyCreated(policy: FullPolicy): Promise<void> {
    await policyDispatch.dispatchPolicyCreated(policy);
  }

  async dispatchPolicyUpdated(
    previous: FullPolicy,
    current: FullPolicy,
  ): Promise<void> {
    await policyDispatch.dispatchPolicyUpdated(previous, current);
  }

  async dispatchPolicyDeleted(policy: FullPolicy): Promise<void> {
    await policyDispatch.dispatchPolicyDeleted(policy);
  }

  async dispatchJobUpdated(
    previous: schema.Job & { metadata?: Record<string, any> },
    current: schema.Job & { metadata?: Record<string, any> },
  ): Promise<void> {
    await jobDispatch.dispatchJobUpdated(previous, current);
  }

  dispatchEvaluateReleaseTarget(
    _: schema.ReleaseTarget,
    __?: { skipDuplicateCheck?: boolean },
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
