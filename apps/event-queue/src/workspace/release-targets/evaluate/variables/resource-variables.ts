import type { FullReleaseTarget } from "@ctrlplane/events";

import type { Workspace } from "../../../workspace.js";

export class ResourceVariableProvider {
  constructor(
    private readonly workspace: Workspace,
    private readonly releaseTarget: FullReleaseTarget,
  ) {}

  private async getResourceVariable(key: string) {
    const { resource } = this.releaseTarget;
    const allVariables = await this.workspace.repository.resourceVariableRepository.getAll();
    return allVariables.find((v) => v.resourceId === resource.id && v.key === key);
  }

  async getValue(
    key: string,
  ): Promise<string | number | boolean | object | null | undefined> {
    const resourceVariable = await this.getResourceVariable(key);
    if (resourceVariable == null) return undefined;

    if (resourceVariable.valueType === "direct")

  }
}
