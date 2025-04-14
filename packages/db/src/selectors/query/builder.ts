import type { EnvironmentCondition } from "@ctrlplane/validators/environments";

import type { ResourceCondition } from "@ctrlplane/validators/resources";

import type { Tx } from "../../common.js";
import type { Environment, Resource } from "../../schema/index.js";
import { WhereBuilder } from "./builder-types.js";
import { EnvironmentOutputBuilder } from "./environments-selector.js";
import { ResourceOutputBuilder } from "./resource-selector.js";

export class QueryBuilder {
  constructor(private readonly tx: Tx) {}
  deployments() {}

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
}
