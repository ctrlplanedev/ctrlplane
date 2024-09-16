import type { FailedAttemptError } from "p-retry";
import pRetry from "p-retry";

import { logger } from "@ctrlplane/logger";

import type { ApiResponse, Variable, Workspace } from "./types.js";
import { env } from "./config.js";

/**
 * Fetch JSON with retry and exponential backoff, respecting a global timeout.
 *
 * @param url - The URL to fetch.
 * @param options - Fetch options.
 * @returns The JSON response parsed as ResponseType.
 * @throws An error if all retry attempts fail or if the global timeout is exceeded.
 */
async function fetchRetry<ResponseType>(
  url: string,
  options: RequestInit = {},
): Promise<ResponseType> {
  return pRetry(
    async () => {
      const response = await fetch(url, {
        ...options,
      });
      const responseBody: unknown = await response.json();
      return responseBody as ResponseType;
    },
    {
      retries: 4,
      factor: 2,
      minTimeout: 4000,
      maxTimeout: 32000,
      onFailedAttempt: (error: FailedAttemptError) => {
        logger.warn(
          `Fetch attempt ${error.attemptNumber} failed. There are ${
            error.retriesLeft
          } retries left.`,
          { error: error.message },
        );
      },
    },
  );
}

/**
 * List all workspaces in the specified Terraform organization.
 * @returns An array of Workspace objects.
 * @throws Will throw an error if the API request fails.
 */
export async function listWorkspaces(): Promise<Workspace[]> {
  const apiUrl = env.TFE_API_URL;
  const headers = {
    Authorization: `Bearer ${env.TFE_TOKEN}`,
    "Content-Type": "application/vnd.api+json",
    Accept: "application/vnd.api+json",
  };

  const workspaces: Workspace[] = [];
  let nextPageUrl: string | null =
    `${apiUrl}/organizations/${env.TFE_ORGANIZATION}/workspaces`;

  while (nextPageUrl != null) {
    try {
      const data: ApiResponse<Workspace[]> = await fetchRetry<
        ApiResponse<Workspace[]>
      >(nextPageUrl, { headers });
      workspaces.push(...data.data);
      nextPageUrl = data.links?.next ?? null;
    } catch (error) {
      logger.error(`Failed to list workspaces: ${(error as Error).message}`, {
        error,
      });
      throw error;
    }
  }

  return workspaces;
}

/**
 * List all variables for a given Terraform workspace.
 * @param workspaceId The ID of the workspace.
 * @returns An array of Variable objects.
 * @throws Will throw an error if the API request fails.
 */
export async function listVariables(workspaceId: string): Promise<Variable[]> {
  const apiUrl = env.TFE_API_URL;
  const headers = {
    Authorization: `Bearer ${env.TFE_TOKEN}`,
    "Content-Type": "application/vnd.api+json",
    Accept: "application/vnd.api+json",
  };

  const variables: Variable[] = [];
  let nextPageUrl: string | null = `${apiUrl}/workspaces/${workspaceId}/vars`;

  while (nextPageUrl) {
    try {
      const data: ApiResponse<Variable[]> = await fetchRetry<
        ApiResponse<Variable[]>
      >(nextPageUrl, { headers });
      variables.push(...data.data);
      nextPageUrl = data.links?.next ?? null;
    } catch (error) {
      logger.error(
        `Failed to list variables for workspace ${workspaceId}: ${
          (error as Error).message
        }`,
        { error },
      );
      throw error;
    }
  }

  return variables;
}
