import type { FullReleaseTarget } from "@ctrlplane/events";
import type { MaybeVariable, VariableProvider } from "@ctrlplane/rule-engine";

import type { Workspace } from "../../../workspace/workspace";

export class ResourceVariableProvider implements VariableProvider {
  constructor(
    private readonly workspace: Workspace,
    private readonly releaseTarget: FullReleaseTarget,
  ) {}

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

  async getVariable(key: string): Promise<MaybeVariable> {
    const variables = await this.getVariables();
    const variable = variables.find((v) => v.key === key) ?? null;
    if (variable == null) return null;
    return {
      id: variable.id,
      key,
      value: variable.value,
      sensitive: variable.sensitive,
    };
  }
}
