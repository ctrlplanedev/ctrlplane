import type { FullReleaseTarget } from "@ctrlplane/events";
import type { MaybeVariable, VariableProvider } from "@ctrlplane/rule-engine";

import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";

import type { Workspace } from "../../../workspace/workspace";
import { Trace } from "../../../traces.js";

const log = logger.child({ component: "resource-variable-provider" });

export class ResourceVariableProvider implements VariableProvider {
  constructor(
    private readonly workspace: Workspace,
    private readonly releaseTarget: FullReleaseTarget,
  ) {}

  @Trace()
  private async getVariables() {
    const allResourceVariables =
      await this.workspace.repository.resourceVariableRepository.getAll();
    const resourceVariables = allResourceVariables.filter(
      (v) => v.resourceId === this.releaseTarget.resourceId,
    );
    return resourceVariables.map((v) => ({
      id: v.id,
      key: v.key,
      value: v.value,
      sensitive: v.sensitive,
    }));
  }

  @Trace()
  private resolveVariableValue(variable: {
    value: string | number | boolean | object | null;
    sensitive: boolean;
  }) {
    const { value, sensitive } = variable;
    if (!sensitive) return value;

    const strValue =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    return variablesAES256().decrypt(strValue);
  }

  @Trace()
  async getVariable(key: string): Promise<MaybeVariable> {
    const now = performance.now();
    const variables = await this.getVariables();
    const variable = variables.find((v) => v.key === key) ?? null;
    if (variable == null) return null;

    const resolvedValue = this.resolveVariableValue(variable);
    const end = performance.now();
    const duration = end - now;
    log.info(`Resource variable resolution took ${duration.toFixed(2)}ms`);

    return {
      id: variable.id,
      key,
      value: resolvedValue,
      sensitive: variable.sensitive,
    };
  }
}
