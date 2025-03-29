import { ReleaseAction, ReleaseCondition, ReleaseRuleEvaluationProps } from "../rule-engine.js";
import { AnyVariable } from "../types.js";

// Variable-specific conditions
export class VariableChangedCondition implements ReleaseCondition {
  constructor(private variableName?: string, private variableType?: string) {}

  async evaluate(props: ReleaseRuleEvaluationProps): Promise<boolean> {
    if (props.release.triggerType !== "variable" || !props.variable) {
      return false;
    }

    // Check variable name if specified
    if (this.variableName && props.variable.name !== this.variableName) {
      return false;
    }

    // Check variable type if specified
    if (this.variableType && props.variable.type !== this.variableType) {
      return false;
    }

    return true;
  }
}

export class VariableValueCondition implements ReleaseCondition {
  constructor(
    private predicate: (value: unknown) => boolean,
    private variableName?: string,
  ) {}

  async evaluate(props: ReleaseRuleEvaluationProps): Promise<boolean> {
    if (props.release.triggerType !== "variable" || !props.variable) {
      return false;
    }

    // Check variable name if specified
    if (this.variableName && props.variable.name !== this.variableName) {
      return false;
    }

    return this.predicate(props.variable.value);
  }
}

export class ContextSpecificCondition implements ReleaseCondition {
  constructor(
    private resourceId?: string,
    private environmentId?: string,
    private deploymentId?: string,
  ) {}

  async evaluate(props: ReleaseRuleEvaluationProps): Promise<boolean> {
    // Check resource ID if specified
    if (this.resourceId) {
      const currentResourceId = props.resource?.id || props.release.resourceId || props.context.resourceId;
      if (currentResourceId !== this.resourceId) {
        return false;
      }
    }

    // Check environment ID if specified
    if (this.environmentId) {
      const currentEnvironmentId = props.environment?.id || props.release.environmentId || props.context.environmentId;
      if (currentEnvironmentId !== this.environmentId) {
        return false;
      }
    }

    // Check deployment ID if specified
    if (this.deploymentId) {
      const currentDeploymentId = props.deployment?.id || props.release.deploymentId || props.context.deploymentId;
      if (currentDeploymentId !== this.deploymentId) {
        return false;
      }
    }

    return true;
  }
}

export class ResourceLabelCondition implements ReleaseCondition {
  constructor(
    private key: string,
    private value: string,
  ) {}

  async evaluate(props: ReleaseRuleEvaluationProps): Promise<boolean> {
    if (!props.resource || !props.resource.labels) {
      return false;
    }

    return props.resource.labels[this.key] === this.value;
  }
}

// Variable-specific actions
export class LogVariableChangeAction implements ReleaseAction {
  async execute(props: ReleaseRuleEvaluationProps): Promise<void> {
    if (props.variable) {
      const variable = props.variable as AnyVariable;
      let contextInfo = "";
      
      if (variable.type === "resourceVariable" && variable.resourceId) {
        contextInfo += ` for resource ${variable.resourceId}`;
      } else if (variable.type === "deploymentVariable" && variable.deploymentId) {
        contextInfo += ` for deployment ${variable.deploymentId}`;
      }
      
      console.log(
        `Variable changed: ${props.variable.name} (${variable.type})${contextInfo} = ${JSON.stringify(
          props.variable.value,
        )}`,
      );
    }
  }
}

export class UpdateDependentVariablesAction implements ReleaseAction {
  constructor(
    private dependentVariableComputer: (
      source: AnyVariable,
      context: ReleaseRuleEvaluationProps,
    ) => Promise<AnyVariable[]>,
  ) {}

  async execute(props: ReleaseRuleEvaluationProps): Promise<void> {
    if (!props.variable) return;

    try {
      // Compute dependent variables based on the changed variable
      const dependentVariables = await this.dependentVariableComputer(
        props.variable as AnyVariable,
        props,
      );

      // Log the dependent variables that were updated
      dependentVariables.forEach((variable) => {
        console.log(
          `Updated dependent variable: ${variable.name} = ${JSON.stringify(variable.value)}`,
        );
      });
    } catch (error) {
      console.error(`Failed to update dependent variables:`, error);
    }
  }
}
