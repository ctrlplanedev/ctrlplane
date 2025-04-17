import type { VersionCondition } from "@ctrlplane/validators/conditions";
import type { DeploymentCondition } from "@ctrlplane/validators/deployments";
import type { EnvironmentCondition } from "@ctrlplane/validators/environments";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { SQL } from "drizzle-orm";

import type { Tx } from "../../common.js";

type SelectorCondition =
  | ResourceCondition
  | VersionCondition
  | DeploymentCondition
  | DeploymentVersionCondition
  | EnvironmentCondition
  | JobCondition;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface OutputBuilder<T extends object> {
  sql(): SQL<unknown> | undefined;
}

export class WhereBuilder<T extends SelectorCondition, O extends object> {
  constructor(
    private readonly tx: Tx,
    private Class: new (tx: Tx, selector?: T | null) => OutputBuilder<O>,
  ) {}

  where(condition?: T | null): OutputBuilder<O> {
    return new this.Class(this.tx, condition);
  }
}
