import type { FullReleaseTarget } from "@ctrlplane/events";

import type { Workspace } from "../../../workspace.js";

export class ResourceVariableProvider {
  constructor(
    private readonly workspace: Workspace,
    private readonly releaseTarget: FullReleaseTarget,
  ) {}

  async getValue(
    key: string,
  ): Promise<string | number | boolean | object | null> {}
}
