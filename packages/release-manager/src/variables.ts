import type { MaybeVariable, VariableProvider } from "./types";

type ReleaseManagerOptions = {
  deploymentId: string;
  resourceId: string;

  keys: string[];
};

export class VariableManager {
  constructor(
    private options: ReleaseManagerOptions,
    private variableProviders: VariableProvider[],
  ) {}

  async getVariables(): Promise<MaybeVariable[]> {
    const variables = await Promise.all(
      this.options.keys.map((key) => this.getVariable(key)),
    );
    return variables;
  }

  async getVariable(key: string): Promise<MaybeVariable> {
    for (const provider of this.variableProviders) {
      const variable = await provider.getVariable(key);
      if (variable) return variable;
    }
    return null;
  }
}
