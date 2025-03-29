import { ReleaseAction, ReleaseCondition, ReleaseRuleEvaluationProps } from "../rule-engine.js";

// Version-specific conditions
export class VersionChangedCondition implements ReleaseCondition {
  constructor(private versionId?: string) {}

  async evaluate(props: ReleaseRuleEvaluationProps): Promise<boolean> {
    if (props.release.triggerType !== "version" || !props.version) {
      return false;
    }

    // Check version ID if specified
    if (this.versionId && props.version.id !== this.versionId) {
      return false;
    }

    return true;
  }
}

export class VersionValueCondition implements ReleaseCondition {
  constructor(
    private predicate: (version: string) => boolean,
    private versionId?: string,
  ) {}

  async evaluate(props: ReleaseRuleEvaluationProps): Promise<boolean> {
    if (props.release.triggerType !== "version" || !props.version) {
      return false;
    }

    // Check version ID if specified
    if (this.versionId && props.version.id !== this.versionId) {
      return false;
    }

    return this.predicate(props.version.version);
  }
}

export class SemverCondition implements ReleaseCondition {
  constructor(
    private semverRequirement: string,
    private versionId?: string,
  ) {}

  async evaluate(props: ReleaseRuleEvaluationProps): Promise<boolean> {
    if (props.release.triggerType !== "version" || !props.version) {
      return false;
    }

    // Check version ID if specified
    if (this.versionId && props.version.id !== this.versionId) {
      return false;
    }

    // Simple semver check (would normally use a proper semver library)
    const version = props.version.version;
    
    // For simple major version check for demonstration
    if (this.semverRequirement.startsWith("^")) {
      const requiredMajor = this.semverRequirement.substring(1).split(".")[0];
      const actualMajor = version.split(".")[0];
      return requiredMajor === actualMajor;
    }
    
    // For exact version match
    if (this.semverRequirement.startsWith("=")) {
      const requiredVersion = this.semverRequirement.substring(1);
      return version === requiredVersion;
    }
    
    // For greater than
    if (this.semverRequirement.startsWith(">")) {
      const requiredVersion = this.semverRequirement.substring(1);
      return this.compareVersions(version, requiredVersion) > 0;
    }
    
    // For less than
    if (this.semverRequirement.startsWith("<")) {
      const requiredVersion = this.semverRequirement.substring(1);
      return this.compareVersions(version, requiredVersion) < 0;
    }
    
    // Default to exact match
    return version === this.semverRequirement;
  }
  
  private compareVersions(a: string, b: string): number {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart !== bPart) {
        return aPart - bPart;
      }
    }
    
    return 0;
  }
}

// Version-specific actions
export class LogVersionChangeAction implements ReleaseAction {
  async execute(props: ReleaseRuleEvaluationProps): Promise<void> {
    if (props.version) {
      let contextInfo = "";
      
      if (props.resource) {
        contextInfo += ` for resource ${props.resource.id}`;
      }
      
      if (props.environment) {
        contextInfo += ` in environment ${props.environment.id}`;
      }
      
      console.log(
        `Version changed: ${props.version.id} = ${props.version.version}${contextInfo}`,
      );
    }
  }
}

export class MajorVersionChangeAction implements ReleaseAction {
  constructor(private callback: (version: string, context: ReleaseRuleEvaluationProps) => Promise<void>) {}

  async execute(props: ReleaseRuleEvaluationProps): Promise<void> {
    if (!props.version) return;

    // Extract major version using semver conventions
    const version = props.version.version;
    const majorVersion = version.split(".")[0];
    
    console.log(`Major version change detected: ${majorVersion}`);
    await this.callback(majorVersion, props);
  }
}

export class TriggerDeploymentAction implements ReleaseAction {
  constructor(private deploymentService: any) {}
  
  async execute(props: ReleaseRuleEvaluationProps): Promise<void> {
    if (!props.version || !props.resource) {
      return;
    }
    
    // Extract context information
    const resourceId = props.resource.id;
    const version = props.version.version;
    const environmentId = props.environment?.id || props.context.environmentId as string;
    
    if (!environmentId) {
      console.error("Cannot deploy without an environment");
      return;
    }
    
    console.log(`Triggering deployment of version ${version} to resource ${resourceId} in environment ${environmentId}`);
    
    try {
      // This would call an external deployment service
      await this.deploymentService.triggerDeployment({
        resourceId,
        environmentId,
        version,
      });
      
      console.log("Deployment triggered successfully");
    } catch (error) {
      console.error("Failed to trigger deployment:", error);
    }
  }
}
