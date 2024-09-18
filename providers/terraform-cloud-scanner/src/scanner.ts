import type { SetTargetProvidersTargetsRequestTargetsInner } from "@ctrlplane/node-sdk";
import handlebars from "handlebars";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";

import type { Variable, Workspace } from "./types.js";
import { listVariables, listWorkspaces } from "./api.js";
import { env } from "./config.js";
import { api } from "./sdk.js";

const workspaceTemplate = handlebars.compile(
  env.CTRLPLANE_WORKSPACE_TARGET_NAME,
);

/**
 * Scans Terraform Cloud workspaces and registers them as targets with prefixed labels and a link.
 */
export async function scan() {
  logger.info("Starting Terraform Cloud scan");

  try {
    const workspaces: Workspace[] = await listWorkspaces();
    logger.info(`Found ${workspaces.length} workspaces`);

    const targets: SetTargetProvidersTargetsRequestTargetsInner[] = [];

    for (const workspace of workspaces) {
      logger.info(
        `Processing workspace: ${workspace.attributes.name} (ID: ${workspace.id})`,
      );

      const variables: Variable[] = await listVariables(workspace.id);
      logger.info(
        ` Found ${variables.length} variables in workspace '${workspace.attributes.name}'`,
      );
      const variableLabels = processVariables(variables);
      const tagLabels = processWorkspaceTags(workspace.attributes["tag-names"]);
      const vcsRepoLabels = processVcsRepo(workspace.attributes["vcs-repo"]);
      const link = buildWorkspaceLink(workspace);
      const targetName = workspaceTemplate({ workspace });

      const target: SetTargetProvidersTargetsRequestTargetsInner = {
        version: "terraform/v1",
        kind: "Workspace",
        name: targetName,
        identifier: workspace.id,
        config: {
          workspaceId: workspace.id,
        },
        labels: {
          "terraform-cloud/organization": env.TFE_ORGANIZATION,
          "terraform-cloud/workspace-name": workspace.attributes.name,
          ...variableLabels,
          ...tagLabels,
          ...vcsRepoLabels,
          "ctrlplane/urls": JSON.stringify(link),
        },
      };

      targets.push(target);
    }

    const uniqueTargets = _.uniqBy(targets, (t) => t.identifier);

    logger.info(`Registering ${uniqueTargets.length} unique targets`);
    const providerId = await getOrCreateProviderId();

    if (!providerId) {
      logger.error(
        "Provider ID is not available. Aborting target registration.",
      );
      return;
    }

    await api.setTargetProvidersTargets({
      providerId,
      setTargetProvidersTargetsRequest: {
        targets: uniqueTargets,
      },
    });

    logger.info("Successfully registered targets");
  } catch (error) {
    logger.error("An error occurred during the scan process:", error);
  }
}

/**
 * Processes variables into Terraform variables and environment variables.
 * @param variables The array of variables to process.
 * @returns An object containing terraformVariables and envVariables.
 */
const processVariables = (variables: Variable[]) =>
  Object.fromEntries(
    variables.map((variable) => {
      return [
        variable.attributes.category === "terraform"
          ? `terraform-cloud/variables:${variable.attributes.key}`
          : `terraform-cloud/environment-variables:${variable.attributes.key}`,
        variable.attributes.value || "",
      ];
    }),
  );

/**
 * Processes workspace tags into prefixed label objects.
 * @param tags The array of tag names associated with the workspace.
 * @returns An object containing prefixed tag labels.
 */
const processWorkspaceTags = (tags: string[] = []) =>
  Object.fromEntries(
    tags.map((tag) => {
      const [key, ...rest] = tag.split(":");
      const value = rest.length > 0 ? rest.join(":") : "true";
      return [`terraform-cloud/tag/${key}`, value];
    }),
  );

/**
 * Processes VCS repository information into labels.
 * @param vcsRepo The VCS repository information from workspace attributes.
 * @returns An object containing VCS repository labels.
 */
function processVcsRepo(
  vcsRepo?: Workspace["attributes"]["vcs-repo"],
): Record<string, string> {
  if (!vcsRepo) return {};

  const { identifier, branch, "repository-http-url": repoUrl } = vcsRepo;

  return {
    ...(identifier && { "terraform-cloud/vcs-repo/identifier": identifier }),
    ...(branch && { "terraform-cloud/vcs-repo/branch": branch }),
    ...(repoUrl && { "terraform-cloud/vcs-repo/repository-http-url": repoUrl }),
  };
}

/**
 * Constructs the link to the Terraform workspace.
 * @param workspace The workspace object.
 * @returns The URL string to the workspace.
 */
function buildWorkspaceLink(workspace: Workspace): Record<string, string> {
  return {
    "Terraform Workspace": `https://app.terraform.io/app/${encodeURIComponent(
      env.TFE_ORGANIZATION,
    )}/workspaces/${encodeURIComponent(workspace.attributes.name)}`,
  };
}

/**
 * Helper function to get or create the provider ID.
 * @returns The provider ID as a string or null if failed.
 */
async function getOrCreateProviderId(): Promise<string | null> {
  return api
    .upsertTargetProvider({
      workspace: env.CTRLPLANE_WORKSPACE,
      name: env.CTRLPLANE_SCANNER_NAME,
    })
    .then(({ id }) => {
      logger.info(`Using provider ID: ${id}`);
      return id;
    })
    .catch((error) => {
      logger.error("Failed to get or create provider ID:", error);
      return null;
    });
}
