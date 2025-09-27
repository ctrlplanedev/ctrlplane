import type { FullReleaseTarget, FullResource } from "@ctrlplane/events";
import type { MaybeVariable, VariableProvider } from "@ctrlplane/rule-engine";
import _ from "lodash";

import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";

import type { Workspace } from "../../../workspace/workspace.js";
import { resourceMatchesSelector } from "../../../selector/in-memory/resource-match.js";

const log = logger.child({ component: "deployment-variable-provider" });

export class DeploymentVariableProvider implements VariableProvider {
  constructor(
    private readonly workspace: Workspace,
    private readonly releaseTarget: FullReleaseTarget,
  ) {}

  private resolveDirectValue(
    variableValue: schema.DirectDeploymentVariableValue,
  ) {
    const { value, sensitive } = variableValue;
    if (!sensitive) return value;

    const strVal =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    return variablesAES256().decrypt(strVal);
  }

  private async getRuleByReference(reference: string) {
    const now = performance.now();
    const allRelationshipRules =
      await this.workspace.repository.resourceRelationshipRuleRepository.getAll();
    const relationshipRule = allRelationshipRules.find(
      (r) => r.reference === reference,
    );
    if (relationshipRule == null) return null;
    const [
      allRelationshipRuleSourceMetadataEquals,
      allRelationshipRuleTargetMetadataEquals,
      allRelationshipRuleMetadataMatch,
    ] = await Promise.all([
      this.workspace.repository.resourceRelationshipRuleSourceMetadataEqualsRepository.getAll(),
      this.workspace.repository.resourceRelationshipRuleTargetMetadataEqualsRepository.getAll(),
      this.workspace.repository.resourceRelationshipRuleMetadataMatchRepository.getAll(),
    ]);

    const metadataKeysMatch = allRelationshipRuleMetadataMatch.filter(
      (r) => r.resourceRelationshipRuleId === relationshipRule.id,
    );
    const targetMetadataEquals = allRelationshipRuleTargetMetadataEquals.filter(
      (r) => r.resourceRelationshipRuleId === relationshipRule.id,
    );
    const sourceMetadataEquals = allRelationshipRuleSourceMetadataEquals.filter(
      (r) => r.resourceRelationshipRuleId === relationshipRule.id,
    );

    const end = performance.now();
    const duration = end - now;
    log.info(
      `Getting relationship rule by reference took ${duration.toFixed(2)}ms`,
    );
    return {
      ...relationshipRule,
      metadataKeysMatch,
      targetMetadataEquals,
      sourceMetadataEquals,
    };
  }

  private targetResourceMatchesRule(
    relationshipRule: schema.ResourceRelationshipRule,
    targetMetadataEqualsRules: schema.ResourceRelationshipRuleTargetMetadataEquals[],
  ) {
    const now = performance.now();
    const { resource } = this.releaseTarget;
    const { targetKind, targetVersion } = relationshipRule;
    const targetKindSatisfied =
      targetKind == null || targetKind === resource.kind;
    const targetVersionSatisfied =
      targetVersion == null || targetVersion === resource.version;
    if (!targetKindSatisfied || !targetVersionSatisfied) return false;

    for (const t of targetMetadataEqualsRules) {
      const targetMetadata = resource.metadata[t.key];
      if (targetMetadata == null || targetMetadata !== t.value) return false;
    }

    const end = performance.now();
    const duration = end - now;
    log.info(`Target resource matches rule took ${duration.toFixed(2)}ms`);
    return true;
  }

  private async getSourceResourceCandidates(
    relationshipRule: schema.ResourceRelationshipRule,
  ) {
    const now = performance.now();
    const { sourceKind, sourceVersion } = relationshipRule;
    const allResources =
      await this.workspace.repository.resourceRepository.getAll();
    const resources = allResources.filter(
      (r) =>
        r.kind === sourceKind &&
        r.version === sourceVersion &&
        r.deletedAt == null,
    );
    const end = performance.now();
    const duration = end - now;
    log.info(
      `Getting source resource candidates took ${duration.toFixed(2)}ms`,
    );
    return resources;
  }

  private sourceResourceMatchesRule(
    sourceMetadataEqualsRules: schema.ResourceRelationshipRuleSourceMetadataEquals[],
    metadataKeysMatchRules: schema.ResourceRelationshipRuleMetadataMatch[],
    candidate: FullResource,
  ) {
    const { resource } = this.releaseTarget;
    for (const s of sourceMetadataEqualsRules) {
      const sourceMetadata = candidate.metadata[s.key];
      if (sourceMetadata == null || sourceMetadata !== s.value) return false;
    }

    for (const m of metadataKeysMatchRules) {
      const sourceMetadata = candidate.metadata[m.sourceKey];
      const targetMetadata = resource.metadata[m.targetKey];
      if (
        sourceMetadata == null ||
        targetMetadata == null ||
        sourceMetadata !== targetMetadata
      )
        return false;
    }

    return true;
  }

  private async getFullSource(
    resource: FullResource,
  ): Promise<
    FullResource & { variables: Record<string, string | number | boolean> }
  > {
    const allVariables =
      await this.workspace.repository.resourceVariableRepository.getAll();
    const variables = Object.fromEntries(
      allVariables
        .filter((v) => v.resourceId === resource.id)
        .filter((v) => v.valueType === "direct")
        .map((v) => {
          const { value, key } = v;
          if (v.sensitive)
            return [key, variablesAES256().decrypt(String(value))];
          if (typeof value === "object") return [key, JSON.stringify(value)];
          return [key, value];
        }),
    );
    return { ...resource, variables };
  }

  private async resolveReferenceValue(
    variableValue: schema.ReferenceDeploymentVariableValue,
  ) {
    const { reference, path } = variableValue;
    const defaultValue = variableValue.defaultValue ?? null;
    const relationshipRule = await this.getRuleByReference(reference);
    if (relationshipRule == null) return defaultValue;
    const { targetMetadataEquals, sourceMetadataEquals, metadataKeysMatch } =
      relationshipRule;
    if (!this.targetResourceMatchesRule(relationshipRule, targetMetadataEquals))
      return defaultValue;

    const sourceResourceCandidates =
      await this.getSourceResourceCandidates(relationshipRule);
    if (sourceResourceCandidates.length === 0) return defaultValue;

    const sourceResourceSearchStart = performance.now();
    const sourceResource = sourceResourceCandidates.find((r) =>
      this.sourceResourceMatchesRule(
        sourceMetadataEquals,
        metadataKeysMatch,
        r,
      ),
    );
    const sourceResourceSearchEnd = performance.now();
    const sourceResourceSearchDuration =
      sourceResourceSearchEnd - sourceResourceSearchStart;
    log.info(
      `Source resource search took ${sourceResourceSearchDuration.toFixed(2)}ms`,
    );
    if (sourceResource == null) return defaultValue;

    const fullSourceStart = performance.now();
    const fullSource = await this.getFullSource(sourceResource);
    const fullSourceEnd = performance.now();
    const fullSourceDuration = fullSourceEnd - fullSourceStart;
    log.info(`Full source retrieval took ${fullSourceDuration.toFixed(2)}ms`);
    const resolvedPath = _.get(fullSource, path, defaultValue);
    return resolvedPath as string | number | boolean | object | null;
  }

  private async resolveVariableValue(
    key: string,
    variableValue: schema.DeploymentVariableValue,
  ): Promise<MaybeVariable> {
    if (schema.isDeploymentVariableValueDirect(variableValue)) {
      const resolvedValue = this.resolveDirectValue(variableValue);
      return {
        id: variableValue.id,
        key,
        value: resolvedValue,
        sensitive: variableValue.sensitive,
      };
    }

    if (schema.isDeploymentVariableValueReference(variableValue)) {
      const resolvedValue = await this.resolveReferenceValue(variableValue);
      return {
        id: variableValue.id,
        key,
        value: resolvedValue,
        sensitive: false,
      };
    }

    return null;
  }

  private async getDeploymentVariable(key: string) {
    const now = performance.now();
    const allDeploymentVariables =
      await this.workspace.repository.deploymentVariableRepository.getAll();
    const deploymentVariable = allDeploymentVariables.find(
      (v) =>
        v.deploymentId === this.releaseTarget.deploymentId && v.key === key,
    );
    if (deploymentVariable == null) {
      const end = performance.now();
      const duration = end - now;
      log.info(
        `Getting actual deployment variable took ${duration.toFixed(2)}ms`,
      );
      return null;
    }
    const allDeploymentVariableValues =
      await this.workspace.repository.deploymentVariableValueRepository.getAll();
    const values = allDeploymentVariableValues.filter(
      (v) => v.variableId === deploymentVariable.id,
    );
    const defaultValue = values.find(
      (value) => value.id === deploymentVariable.defaultValueId,
    );
    const end = performance.now();
    const duration = end - now;
    log.info(
      `Getting actual deployment variable took ${duration.toFixed(2)}ms`,
    );
    return { ...deploymentVariable, values, defaultValue };
  }

  async getVariable(key: string): Promise<MaybeVariable> {
    log.info(`Resolving deployment variable ${key}`);
    const deploymentVariable = await this.getDeploymentVariable(key);
    if (deploymentVariable == null) return null;

    const { values, defaultValue } = deploymentVariable;
    const sortedValues = values.sort((a, b) => b.priority - a.priority);

    const { resource } = this.releaseTarget;
    for (const value of sortedValues) {
      if (value.resourceSelector == null) continue;
      const matchStart = performance.now();
      const match = resourceMatchesSelector(resource, value.resourceSelector);
      const matchEnd = performance.now();
      const matchDuration = matchEnd - matchStart;
      log.info(`Resource matches selector took ${matchDuration.toFixed(2)}ms`);
      if (!match) continue;

      const resolveStart = performance.now();
      const resolvedValue = await this.resolveVariableValue(key, value);
      const resolveEnd = performance.now();
      const resolveDuration = resolveEnd - resolveStart;
      log.info(
        `Resolving deployment variable value took ${resolveDuration.toFixed(2)}ms`,
      );
      if (resolvedValue != null) return resolvedValue;
    }

    if (defaultValue != null) {
      const resolvedValue = await this.resolveVariableValue(key, defaultValue);
      if (resolvedValue != null) return resolvedValue;
    }

    return {
      id: deploymentVariable.id,
      key,
      value: null,
      sensitive: false,
    };
  }
}
