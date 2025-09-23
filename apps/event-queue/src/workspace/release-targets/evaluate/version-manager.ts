import type { FullReleaseTarget } from "@ctrlplane/events";
import type { ReleaseManager } from "@ctrlplane/rule-engine";
import { isPresent } from "ts-is-present";

import { VersionRuleEngine } from "@ctrlplane/rule-engine";
import { DeploymentVersionStatus } from "@ctrlplane/validators/releases";

import type { Workspace } from "../../workspace.js";

export class VersionManager implements ReleaseManager {
  constructor(
    private readonly releaseTarget: FullReleaseTarget,
    private readonly workspace: Workspace,
  ) {}

  private get releases() {
    return this.workspace.repository.versionReleaseRepository;
  }

  private get versions() {
    return this.workspace.repository.versionRepository;
  }

  private get versionSelectors() {
    return this.workspace.selectorManager.deploymentVersionSelector;
  }

  private get policies() {
    return this.workspace.repository.policyRepository;
  }

  private get policyTargetSelectors() {
    return this.workspace.selectorManager.policyTargetReleaseTargetSelector;
  }

  private get rules() {
    return this.workspace.repository.versionRuleRepository;
  }

  private async findLatestRelease() {
    const allReleases = await this.releases.getAll();
    const releasesForTarget = allReleases.filter(
      (release) => release.releaseTargetId === this.releaseTarget.id,
    );
    return releasesForTarget.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
  }

  async upsertRelease(versionId: string) {
    const latestRelease = await this.findLatestRelease();
    if (latestRelease?.versionId === versionId)
      return { created: false, release: latestRelease };

    const release = await this.releases.create({
      id: crypto.randomUUID(),
      createdAt: new Date(),
      versionId,
      releaseTargetId: this.releaseTarget.id,
    });
    return { created: true, release };
  }

  private async findVersionsForEvaluation(policyIds: Set<string>) {
    const allVersions = await this.versions.getAll();
    let versionsToEvaluate = allVersions
      .filter((v) => v.deploymentId === this.releaseTarget.deploymentId)
      .filter((v) => v.status === DeploymentVersionStatus.Ready)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const allSelectors = await this.versionSelectors.getAllSelectors();
    const selectors = allSelectors.filter((s) => policyIds.has(s.policyId));
    for (const selector of selectors) {
      const matchedEntities = await Promise.all(
        versionsToEvaluate.map(async (v) => {
          const isMatch = await this.versionSelectors.isMatch(v, selector);
          return isMatch ? v : null;
        }),
      ).then((entities) => entities.filter(isPresent));
      versionsToEvaluate = matchedEntities;
    }

    return versionsToEvaluate;
  }

  private async getPoliciesIds() {
    const policyTargets =
      await this.policyTargetSelectors.getSelectorsForEntity(
        this.releaseTarget,
      );
    return new Set<string>(policyTargets.map((pt) => pt.policyId));
  }

  async evaluate() {
    const policyIds = await this.getPoliciesIds();
    const allPolicies = await this.policies.getAll();
    const policies = allPolicies.filter((p) => policyIds.has(p.id));

    const policyRules = await Promise.all(
      policies.map((p) => this.rules.getRules(p.id, this.releaseTarget.id)),
    ).then((rules) => rules.flat());
    const versions = await this.findVersionsForEvaluation(policyIds);
    return new VersionRuleEngine(policyRules).evaluate(versions);
  }
}
