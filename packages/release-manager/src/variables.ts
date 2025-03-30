import type { MaybeVariable, VariableProvider, VariableProviderOptions } from "./types.js";
import { 
  DefaultVariableProviderRegistry, 
  getDeploymentVariableKeys 
} from "./providers/variable-provider-factories.js";

type VariableManagerOptions = VariableProviderOptions & {
  keys: string[];
};

export class VariableManager {
  static async database(options: VariableProviderOptions) {
    const keys = await getDeploymentVariableKeys({ 
      deploymentId: options.deploymentId,
      db: options.db 
    });

    const registry = new DefaultVariableProviderRegistry();
    const providers = registry.getFactories().map(factory => factory.create(options));

    return new VariableManager({ ...options, keys }, providers);
  }

  constructor(
    private options: VariableManagerOptions,
    private variableProviders: VariableProvider[],
  ) {}

  getProviders() {
    return [...this.variableProviders];
  }

  addProvider(provider: VariableProvider) {
    this.variableProviders.push(provider);
    return this;
  }

  async getVariables(): Promise<MaybeVariable[]> {
    return Promise.all(this.options.keys.map((key) => this.getVariable(key)));
  }

  async getVariable(key: string): Promise<MaybeVariable> {
    for (const provider of this.variableProviders) {
      const variable = await provider.getVariable(key);
      if (variable) return variable;
    }
    return null;
  }
}