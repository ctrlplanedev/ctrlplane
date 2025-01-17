import handlebars from "handlebars";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { logger } from "@ctrlplane/logger";
import { ResourceProvider } from "@ctrlplane/node-sdk";

import type { Variable, Workspace } from "./types.js";
import { listVariables, listWorkspaces } from "./api.js";
import { env } from "./config.js";
import { api } from "./sdk.js";

const workspaceTemplate = handlebars.compile(
  env.CTRLPLANE_WORKSPACE_RESOURCE_NAME,
);

const RATE_LIMIT_MS = 1000;
const RATE_LIMIT_CHUNK_SIZE = 10;

type Resource = {
  version: string;
  kind: string;
  name: string;
  identifier: string;
  config: Record<string, string>;
  metadata: Record<string, string>;
};

const processWorkspaceChunk = (workspaceChunk: Workspace[]) =>
  workspaceChunk.map(async (workspace) => {
    try {
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
      const resourceName = workspaceTemplate({ workspace });

      return {
        version: "terraform/v1",
        kind: "Workspace",
        name: resourceName,
        identifier: workspace.id,
        config: {
          workspaceId: workspace.id,
        },
        metadata: {
          "ctrlplane/external-id": workspace.id,
          "terraform-cloud/organization": env.TFE_ORGANIZATION,
          "terraform-cloud/workspace-name": workspace.attributes.name,
          "terraform-cloud/workspace-auto-apply": String(
            workspace.attributes["auto-apply"] ?? false,
          ),
          "terraform/version": workspace.attributes["terraform-version"] ?? "",
          ...variableLabels,
          ...tagLabels,
          ...vcsRepoLabels,
          "ctrlplane/links": JSON.stringify(link),
        },
      };
    } catch (error) {
      logger.error("Error processing workspace", {
        error,
        workspace,
      });
      return null;
    }
  });

/**
 * Scans Terraform Cloud workspaces and registers them as resources with prefixed labels and a link.
 */
export async function scan() {
  const workspaceId = env.CTRLPLANE_WORKSPACE_ID;
  const name = env.CTRLPLANE_SCANNER_NAME;
  const scanner = new ResourceProvider({ workspaceId, name }, api);
  logger.info("Starting Terraform Cloud scan");

  try {
    const provider = await scanner.get();

    logger.info(`Scanner ID: ${provider.id}`, { id: provider.id });
    logger.info("Running Terrafrom Cloud scanner", {
      date: new Date().toISOString(),
    });

    const workspaces: Workspace[] = await listWorkspaces();
    logger.info(`Found ${workspaces.length} workspaces`);

    const resources = await _.chain(workspaces)
      .chunk(RATE_LIMIT_CHUNK_SIZE)
      .reduce(
        async (acc, chunk) => {
          const prevResults = await acc;
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
          const results = await Promise.allSettled(
            processWorkspaceChunk(chunk),
          );
          const processedResults = results
            .map((result) =>
              result.status === "fulfilled" ? result.value : null,
            )
            .filter(isPresent);
          return [...prevResults, ...processedResults];
        },
        Promise.resolve([] as Resource[]),
      )
      .value();

    logger.info(`Registering ${resources.length} unique resources`);
    await scanner.set(resources);
    logger.info("Successfully registered resources");
  } catch (error) {
    logger.error("An error occurred during the scan process:", error);
    process.exit(1);
  }
}

/**
 * Processes variables into Terraform variables.
 * @param variables The array of variables to process.
 * @returns An object containing terraformVariables.
 */
const processVariables = (variables: Variable[]) =>
  Object.fromEntries(
    variables
      .filter((variable) => variable.attributes.category === "terraform")
      .filter((variable) => variable.attributes.sensitive === false)
      .map((variable) => [
        `terraform-cloud/variables/${variable.attributes.key}`,
        variable.attributes.value,
      ]),
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
const processVcsRepo = (
  vcsRepo?: Workspace["attributes"]["vcs-repo"],
): Record<string, string> => {
  if (!vcsRepo) return {};

  const { identifier, branch, "repository-http-url": repoUrl } = vcsRepo;

  return {
    ...(identifier && { "terraform-cloud/vcs-repo/identifier": identifier }),
    ...(branch && { "terraform-cloud/vcs-repo/branch": branch }),
    ...(repoUrl && { "terraform-cloud/vcs-repo/repository-http-url": repoUrl }),
  };
};

/**
 * Constructs the link to the Terraform workspace.
 * @param workspace The workspace object.
 * @returns The URL string to the workspace.
 */
const buildWorkspaceLink = (workspace: Workspace): Record<string, string> => ({
  "Terraform Workspace": `https://app.terraform.io/app/${encodeURIComponent(
    env.TFE_ORGANIZATION,
  )}/workspaces/${encodeURIComponent(workspace.attributes.name)}`,
});
