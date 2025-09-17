import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  selector as selectorQuery,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Selector } from "../selector";

type DbDeploymentVersionSelectorOptions = {
  workspaceId: string;
  db?: Tx;
};

export class DbDeploymentVersionSelector
  implements
    Selector<schema.PolicyDeploymentVersionSelector, schema.DeploymentVersion>
{
  private db: Tx;
  private workspaceId: string;

  constructor(opts: DbDeploymentVersionSelectorOptions) {
    this.db = opts.db ?? dbClient;
    this.workspaceId = opts.workspaceId;
  }

  async upsertEntity(entity: schema.DeploymentVersion): Promise<void> {
    await this.db
      .insert(schema.deploymentVersion)
      .values(entity)
      .onConflictDoUpdate({
        target: [
          schema.deploymentVersion.deploymentId,
          schema.deploymentVersion.tag,
        ],
        set: buildConflictUpdateColumns(schema.deploymentVersion, [
          "name",
          "tag",
          "config",
          "jobAgentConfig",
          "status",
          "message",
        ]),
      });
  }
  async removeEntity(entity: schema.DeploymentVersion): Promise<void> {
    await this.db
      .delete(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.id, entity.id));
  }
  async upsertSelector(
    selector: schema.PolicyDeploymentVersionSelector,
  ): Promise<void> {
    await this.db
      .insert(schema.policyRuleDeploymentVersionSelector)
      .values(selector)
      .onConflictDoUpdate({
        target: [schema.policyRuleDeploymentVersionSelector.policyId],
        set: buildConflictUpdateColumns(
          schema.policyRuleDeploymentVersionSelector,
          ["deploymentVersionSelector", "name"],
        ),
      });
  }
  async removeSelector(
    selector: schema.PolicyDeploymentVersionSelector,
  ): Promise<void> {
    await this.db
      .delete(schema.policyRuleDeploymentVersionSelector)
      .where(eq(schema.policyRuleDeploymentVersionSelector.id, selector.id));
  }
  getEntitiesForSelector(
    selector: schema.PolicyDeploymentVersionSelector,
  ): Promise<schema.DeploymentVersion[]> {
    return this.db
      .select()
      .from(schema.deploymentVersion)
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(
        and(
          eq(schema.system.workspaceId, this.workspaceId),
          selectorQuery(this.db)
            .query()
            .deploymentVersions()
            .where(selector.deploymentVersionSelector)
            .sql(),
        ),
      )
      .then((results) => results.map((result) => result.deployment_version));
  }

  async getSelectorsForEntity(
    entity: schema.DeploymentVersion,
  ): Promise<schema.PolicyDeploymentVersionSelector[]> {
    const wsSelectors = await this.db
      .select()
      .from(schema.policyRuleDeploymentVersionSelector)
      .innerJoin(
        schema.policy,
        eq(
          schema.policyRuleDeploymentVersionSelector.policyId,
          schema.policy.id,
        ),
      )
      .where(eq(schema.policy.workspaceId, this.workspaceId))
      .then((results) =>
        results.map((result) => result.policy_rule_deployment_version_selector),
      );

    return Promise.all(
      wsSelectors.map((selector) =>
        this.db
          .select()
          .from(schema.deploymentVersion)
          .where(
            and(
              eq(schema.deploymentVersion.id, entity.id),
              selectorQuery(this.db)
                .query()
                .deploymentVersions()
                .where(selector.deploymentVersionSelector)
                .sql(),
            ),
          )
          .then(takeFirstOrNull)
          .then((result) => (result != null ? selector : null)),
      ),
    ).then((results) => results.filter(isPresent));
  }
  getAllEntities(): Promise<schema.DeploymentVersion[]> {
    return this.db
      .select()
      .from(schema.deploymentVersion)
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId))
      .then((results) => results.map((result) => result.deployment_version));
  }

  getAllSelectors(): Promise<schema.PolicyDeploymentVersionSelector[]> {
    return this.db
      .select()
      .from(schema.policyRuleDeploymentVersionSelector)
      .innerJoin(
        schema.policy,
        eq(
          schema.policyRuleDeploymentVersionSelector.policyId,
          schema.policy.id,
        ),
      )
      .where(eq(schema.policy.workspaceId, this.workspaceId))
      .then((results) =>
        results.map((result) => result.policy_rule_deployment_version_selector),
      );
  }

  isMatch(
    entity: schema.DeploymentVersion,
    selector: schema.PolicyDeploymentVersionSelector,
  ): Promise<boolean> {
    return this.db
      .select()
      .from(schema.deploymentVersion)
      .where(
        and(
          eq(schema.deploymentVersion.id, entity.id),
          selectorQuery(this.db)
            .query()
            .deploymentVersions()
            .where(selector.deploymentVersionSelector)
            .sql(),
        ),
      )
      .then(takeFirstOrNull)
      .then(isPresent);
  }
}
