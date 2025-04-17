import type { DeploymentCondition } from "@ctrlplane/validators/deployments";
import type { EnvironmentCondition } from "@ctrlplane/validators/environments";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";

import type { Tx } from "../../common.js";
import type {
  Deployment,
  DeploymentVersion,
  Environment,
  Job,
  Resource,
} from "../../schema/index.js";
import { WhereBuilder } from "./builder-types.js";
import { DeploymentOutputBuilder } from "./deployment-selector.js";
import { DeploymentVersionOutputBuilder } from "./deployment-version-selector.js";
import { EnvironmentOutputBuilder } from "./environments-selector.js";
import { JobOutputBuilder } from "./job-selector.js";
import { ResourceOutputBuilder } from "./resource-selector.js";

export class QueryBuilder {
  constructor(private readonly tx: Tx) {}
  deployments() {
    return new WhereBuilder<DeploymentCondition, Deployment>(
      this.tx,
      DeploymentOutputBuilder,
    );
  }

  deploymentVersions() {
    return new WhereBuilder<DeploymentVersionCondition, DeploymentVersion>(
      this.tx,
      DeploymentVersionOutputBuilder,
    );
  }

  environments() {
    return new WhereBuilder<EnvironmentCondition, Environment>(
      this.tx,
      EnvironmentOutputBuilder,
    );
  }

  resources() {
    return new WhereBuilder<ResourceCondition, Resource>(
      this.tx,
      ResourceOutputBuilder,
    );
  }

  jobs() {
    return new WhereBuilder<JobCondition, Job>(this.tx, JobOutputBuilder);
  }
}
