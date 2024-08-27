import { and, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import type {
  GithubOrganization} from "@ctrlplane/db/schema";
import {
  deployment,
  githubConfigFile,
  system,
  workspace,
} from "@ctrlplane/db/schema";

interface DeploymentConfig {
  name: string;
  slug: string;
  system: string;
  workspace: string;
  description?: string;
}

interface ParsedConfig {
  path: string;
  repositoryName: string;
  branch: string;
  deployments: DeploymentConfig[];
}

export const handleNewConfigs = async (
  newParsedConfigs: ParsedConfig[],
  internalOrganization: GithubOrganization,
  repositoryName: string,
) => {
  if (newParsedConfigs.length === 0) return;

  const newConfigs = await db
    .insert(githubConfigFile)
    .values(
      newParsedConfigs.map((cf) => ({
        ...cf,
        workspaceId: internalOrganization.workspaceId,
        organizationId: internalOrganization.id,
        repositoryName: repositoryName,
      })),
    )
    .returning();

  const newDeploymentInfo = await db
    .select()
    .from(system)
    .innerJoin(workspace, eq(system.workspaceId, workspace.id))
    .where(
      and(
        inArray(
          system.slug,
          newParsedConfigs
            .map((d) => d.deployments.map((d) => d.system))
            .flat(),
        ),
        inArray(
          workspace.slug,
          newParsedConfigs
            .map((d) => d.deployments.map((d) => d.workspace))
            .flat(),
        ),
      ),
    );

  const deploymentsFromNewConfigs = newParsedConfigs
    .map((cf) =>
      cf.deployments.map((d) => {
        const info = newDeploymentInfo.find(
          (i) => i.system.slug === d.system && i.workspace.slug === d.workspace,
        );
        if (info == null) throw new Error("Deployment info not found");
        const { system, workspace } = info;

        return {
          ...d,
          systemId: system.id,
          workspaceId: workspace.id,
          description: d.description ?? "",
          githubConfigFileId: newConfigs.find(
            (icf) =>
              icf.path === cf.path && icf.repositoryName === cf.repositoryName,
          )?.id,
        };
      }),
    )
    .flat();

  await db.insert(deployment).values(deploymentsFromNewConfigs);
};

export const handleModifiedConfigs = async (
  modifiedParsedConfigs: ParsedConfig[],
  internalOrganization: GithubOrganization,
  repositoryName: string,
) => {
  if (modifiedParsedConfigs.length === 0) return;
  const existingConfigs = await db
    .select()
    .from(githubConfigFile)
    .where(
      and(
        inArray(
          githubConfigFile.path,
          modifiedParsedConfigs.map((cf) => cf.path),
        ),
        eq(githubConfigFile.organizationId, internalOrganization.id),
        eq(githubConfigFile.repositoryName, repositoryName),
      ),
    );

  const existingDeployments = await db
    .select()
    .from(deployment)
    .innerJoin(system, eq(deployment.systemId, system.id))
    .innerJoin(workspace, eq(system.workspaceId, workspace.id))
    .where(
      inArray(
        deployment.githubConfigFileId,
        existingConfigs.map((c) => c.id),
      ),
    );

  const deploymentsInConfigFiles = modifiedParsedConfigs
    .map((d) => d.deployments)
    .flat();

  const removedDeployments = existingDeployments.filter(
    (ed) =>
      !deploymentsInConfigFiles.some(
        (dc) =>
          dc.slug === ed.deployment.slug &&
          dc.system === ed.system.slug &&
          dc.workspace === ed.workspace.slug,
      ),
  );

  if (removedDeployments.length > 0)
    await db.delete(deployment).where(
      inArray(
        deployment.id,
        removedDeployments.map((d) => d.deployment.id),
      ),
    );

  const newDeployments = modifiedParsedConfigs
    .map((cf) =>
      cf.deployments.map((d) => ({
        ...d,
        cf: {
          path: cf.path,
          repositoryName: cf.repositoryName,
        },
      })),
    )
    .flat()
    .filter(
      (d) =>
        !existingDeployments.some(
          (ed) =>
            ed.deployment.slug === d.slug &&
            ed.system.slug === d.system &&
            ed.workspace.slug === d.workspace,
        ),
    );

  if (newDeployments.length === 0) return;

  const newDeploymentInfo = await db
    .select()
    .from(system)
    .innerJoin(workspace, eq(system.workspaceId, workspace.id))
    .where(
      and(
        inArray(
          system.slug,
          newDeployments.map((d) => d.system),
        ),
        inArray(
          workspace.slug,
          newDeployments.map((d) => d.workspace),
        ),
      ),
    );

  const newDeploymentsInsert = newDeployments.map((d) => {
    const info = newDeploymentInfo.find(
      (i) => i.system.slug === d.system && i.workspace.slug === d.workspace,
    );
    if (info == null) throw new Error("Deployment info not found");
    const { system, workspace } = info;

    return {
      ...d,
      systemId: system.id,
      workspaceId: workspace.id,
      description: d.description ?? "",
      githubConfigFileId: existingConfigs.find(
        (icf) =>
          icf.path === d.cf.path && icf.repositoryName === d.cf.repositoryName,
      )?.id,
    };
  });

  await db.insert(deployment).values(newDeploymentsInsert);
};
