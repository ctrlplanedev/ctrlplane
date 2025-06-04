export interface DeploymentVariableValueRef {
  id: string;
  value: any;
  valueType?: "direct" | "reference";
  sensitive?: boolean;
  resourceSelector?: any;
  default?: boolean;
}

export class DeploymentVariableRef {
  public readonly values: Array<DeploymentVariableValueRef> = [];

  constructor(
    public id: string,
    public key: string,
    public config: Record<string, any>,
    public description?: string,
  ) {}
}

export interface DeploymentVersionRef {
  id: string;
  name: string;
  tag: string;
  status: "building" | "ready" | "failed";
}

export class DeploymentRef {
  public readonly versions: Array<DeploymentVersionRef> = [];
  public readonly variables: Array<DeploymentVariableRef> = [];

  constructor(
    public id: string,
    public name: string,
    public slug: string,
    public originalName?: string,
  ) {}
}

export interface SystemRef {
  id: string;
  name: string;
  slug: string;
  originalName?: string;
}

export interface EnvironmentRef {
  id: string;
  name: string;
  originalName?: string;
}

export interface ResourceRef {
  identifier: string;
  name: string;
  kind: string;
  originalIdentifier?: string;
  metadata?: Record<string, string>;
}

export interface PolicyRef {
  id: string;
  name: string;
  originalName?: string;
}

export type AgentRef = {
  id: string;
  name: string;
};

export class EntityRefs {
  public environments: Array<EnvironmentRef> = [];

  public resources: Array<ResourceRef> = [];

  public deployments: Array<DeploymentRef> = [];

  public policies: Array<PolicyRef> = [];

  public agents: Array<AgentRef> = [];

  constructor(
    public readonly prefix: string,
    public readonly system: SystemRef,
  ) {}

  public takeEnvironments(count: number): Array<EnvironmentRef> {
    return takeRandom(this.environments, count);
  }

  public oneEnvironment(): EnvironmentRef {
    return takeRandom(this.environments, 1)[0];
  }

  public getEnvironmentLike(match: string): EnvironmentRef {
    return exactlyOne(
      this.environments.filter((env) => matches(env.name, match)),
    );
  }

  public takeResources(count: number): Array<ResourceRef> {
    return takeRandom(this.resources, count);
  }

  public oneResource(): ResourceRef {
    return takeRandom(this.resources, 1)[0];
  }

  public getResourceLike(match: string): ResourceRef {
    return exactlyOne(
      this.resources.filter(
        (res) => matches(res.name, match) || matches(res.identifier, match),
      ),
    );
  }

  public takeDeployments(count: number): Array<DeploymentRef> {
    return takeRandom(this.deployments, count);
  }

  public oneDeployment(): DeploymentRef {
    return takeRandom(this.deployments, 1)[0];
  }

  public getDeploymentLike(match: string): DeploymentRef {
    return exactlyOne(
      this.deployments.filter((dep) => matches(dep.name, match)),
    );
  }

  public takePolicies(count: number): Array<PolicyRef> {
    return takeRandom(this.policies, count);
  }

  public onePolicy(): PolicyRef {
    if (this.policies.length === 0) {
      throw new Error("No policies available.");
    }
    return this.policies[0];
  }

  public getPolicyLike(match: string): PolicyRef {
    return exactlyOne(
      this.policies.filter((policy) => matches(policy.name, match)),
    );
  }

  public takeAgents(count: number): Array<AgentRef> {
    return takeRandom(this.agents, count);
  }

  public oneAgent(): AgentRef {
    return takeRandom(this.agents, 1)[0];
  }

  public getAgentLike(match: string): AgentRef {
    return exactlyOne(
      this.agents.filter((agent) => matches(agent.name, match)),
    );
  }
}

function exactlyOne<T>(items: Array<T>): T {
  if (items.length !== 1) {
    throw new Error(`Expected exactly one item, but found ${items.length}.`);
  }
  return items[0]!;
}

function matches(wholeName: string, criterion: string): boolean {
  return wholeName.toLowerCase().includes(criterion.toLowerCase());
}

function takeRandom<T>(arr: Array<T>, n: number): Array<T> {
  if (n > arr.length) {
    throw new Error(`Cannot take ${n} elements, only ${arr.length} available.`);
  }
  const shuffled = arr.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}
