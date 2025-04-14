import type { EnvironmentCondition } from "@ctrlplane/validators/environments";

import type { Tx } from "../../common.js";
import type { Environment } from "../../schema/index.js";
import { WhereBuilder } from "./builder-types.js";
import { EnvironmentOutputBuilder } from "./environments-selector.js";

export class QueryBuilder {
  constructor(private readonly tx: Tx) {}
  deployments() {}

  environments() {
    return new WhereBuilder<EnvironmentCondition, Environment>(
      this.tx,
      EnvironmentOutputBuilder,
    );
  }
}
