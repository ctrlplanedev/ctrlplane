import type { FullReleaseTarget } from "@ctrlplane/events";
import type {
  MaybeVariable,
  ReleaseManager,
  Variable,
} from "@ctrlplane/rule-engine";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { logger } from "@ctrlplane/logger";

import type { Workspace } from "../../workspace/workspace.js";
import { getCurrentSpan, Trace } from "../../traces.js";
import { getVariableManager } from "./variables/variable-manager.js";

const log = logger.child({ component: "variable-release-manager" });

export class VariableReleaseManager implements ReleaseManager {
  constructor(
    private readonly releaseTarget: FullReleaseTarget,
    private readonly workspace: Workspace,
  ) {}

  private getStringifiedValue(value: any) {
    if (value == null) return null;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  @Trace()
  private async getReleaseValues(releaseId: string) {
    const [allValues, allSnapshots] = await Promise.all([
      this.workspace.repository.variableReleaseValueRepository.getAll(),
      this.workspace.repository.variableValueSnapshotRepository.getAll(),
    ]);
    return allValues
      .filter((value) => value.variableSetReleaseId === releaseId)
      .map((value) => {
        const snapshot = allSnapshots.find(
          (snapshot) => snapshot.id === value.variableValueSnapshotId,
        );
        if (snapshot == null) return null;
        return { ...value, variableValueSnapshot: snapshot };
      })
      .filter(isPresent);
  }

  @Trace()
  private async findLatestRelease() {
    const span = getCurrentSpan();
    const allReleases =
      await this.workspace.repository.variableReleaseRepository.getAll();
    const releasesForTarget = allReleases.filter(
      (release) => release.releaseTargetId === this.releaseTarget.id,
    );
    const latestRelease = releasesForTarget.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
    if (latestRelease == null) return null;

    span?.setAttribute("latestRelease.id", latestRelease.id);

    const releaseValues = await this.getReleaseValues(latestRelease.id);
    span?.setAttribute("releaseValues", JSON.stringify(releaseValues));
    return { ...latestRelease, values: releaseValues };
  }

  @Trace()
  private async insertRelease(releaseTargetId: string) {
    return this.workspace.repository.variableReleaseRepository.create({
      id: crypto.randomUUID(),
      createdAt: new Date(),
      releaseTargetId,
    });
  }

  @Trace()
  private async getExistingValueSnapshots(variables: Variable<any>[]) {
    const allSnapshots =
      await this.workspace.repository.variableValueSnapshotRepository.getAll();
    return allSnapshots.filter((snapshot) =>
      variables.some(
        (v) =>
          v.key === snapshot.key &&
          this.getStringifiedValue(v.value) ===
            this.getStringifiedValue(snapshot.value),
      ),
    );
  }

  @Trace()
  private async getValueSnapshotsForRelease(variables: Variable<any>[]) {
    const existingSnapshots = await this.getExistingValueSnapshots(variables);
    const newVarsToInsert = variables.filter(
      (v) => !existingSnapshots.some((s) => s.key === v.key),
    );
    if (newVarsToInsert.length === 0) return existingSnapshots;
    const newSnapshots = await Promise.all(
      newVarsToInsert.map((v) =>
        this.workspace.repository.variableValueSnapshotRepository.create({
          id: crypto.randomUUID(),
          createdAt: new Date(),
          ...v,
          workspaceId: this.workspace.id,
        }),
      ),
    );

    return [...existingSnapshots, ...newSnapshots];
  }

  @Trace()
  async upsertRelease(variables: MaybeVariable[]) {
    const span = getCurrentSpan();
    const latestRelease = await this.findLatestRelease();

    const oldVars = _(latestRelease?.values ?? [])
      .map((v) => [
        v.variableValueSnapshot.key,
        this.getStringifiedValue(v.variableValueSnapshot.value),
      ])
      .fromPairs()
      .value();

    const newVars = _(variables)
      .compact()
      .map((v) => [v.key, this.getStringifiedValue(v.value)])
      .fromPairs()
      .value();

    const isSame = _.isEqual(oldVars, newVars);
    if (latestRelease != null && isSame) {
      span?.addEvent(
        "Skipped variable release because it was the same as the latest release",
      );
      return { created: false, release: latestRelease };
    }

    span?.addEvent(
      "Creating new variable release because variables were changed",
    );
    span?.setAttribute("oldVars", JSON.stringify(oldVars));
    span?.setAttribute("newVars", JSON.stringify(newVars));
    const release = await this.insertRelease(this.releaseTarget.id);
    const vars = _.compact(variables);
    if (vars.length === 0) {
      return { created: true, release };
    }
    const valueSnapshots = await this.getValueSnapshotsForRelease(vars);
    if (valueSnapshots.length === 0)
      throw new Error(
        "upsert variable release had variables to insert, but no snapshots were found",
      );

    await Promise.all(
      valueSnapshots.map((v) =>
        this.workspace.repository.variableReleaseValueRepository.create({
          id: crypto.randomUUID(),
          createdAt: new Date(),
          variableSetReleaseId: release.id,
          variableValueSnapshotId: v.id,
        }),
      ),
    );

    return { created: true, release };
  }

  @Trace()
  async evaluate() {
    try {
      const variableManager = await getVariableManager(
        this.workspace,
        this.releaseTarget,
      );
      const variables = await variableManager.getVariables();
      return { chosenCandidate: variables };
    } catch (error) {
      log.error("Error evaluating variable release", { error });
      return { chosenCandidate: [] };
    }
  }
}
