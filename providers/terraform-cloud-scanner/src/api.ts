import type { FailedAttemptError } from "p-retry";
import pRetry, { AbortError } from "p-retry";

import { logger } from "@ctrlplane/logger";

import type { ApiError, ApiResponse, Variable, Workspace } from "./types.js";
import { env } from "./config.js";

const GLOBAL_TIMEOUT = 60 * 1000;

/**
 * Fetch JSON with retry and exponential backoff, respecting a global timeout.
 *
 * @param url - The URL to fetch.
 * @param options - Fetch options.
 * @returns The JSON response parsed as ResponseType.
 * @throws An error if all retry attempts fail or if the global timeout is exceeded.
 */
async function fetchJson<ResponseType>(
  url: string,
  options: RequestInit = {},
): Promise<ResponseType> {
  const startTime = Date.now();

  return pRetry(
    async () => {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = GLOBAL_TIMEOUT - elapsedTime;

      if (remainingTime <= 0) {
        throw new AbortError("Global timeout of 60 seconds exceeded.");
      }

      const ATTEMPT_TIMEOUT = Math.min(remainingTime, 30 * 1000);

      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, ATTEMPT_TIMEOUT);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const contentType = response.headers.get("content-type");

        if (!contentType?.toLowerCase().includes("json"))
          throw new AbortError(`Unexpected content type: ${contentType}`);

        const responseBody: unknown = await response.json();

        if (!response.ok) {
          const errorBody = responseBody as ApiError;
          const errorMessage = errorBody.errors
            .map((e) => `${e.status} ${e.title}: ${e.detail}`)
            .join("; ");
          throw new AbortError(`API Error: ${errorMessage}`);
        }

        return responseBody as ResponseType;
      } catch (error) {
        clearTimeout(timeout);

        if ((error as any).name === "AbortError")
          throw new AbortError("Request timed out.");
        if (error instanceof TypeError && error.message === "Failed to fetch")
          throw error;
        if (error instanceof Error && /5\d\d/.test(error.message)) throw error;
        throw new AbortError((error as Error).message);
      }
    },
    {
      retries: 4,
      factor: 2,
      minTimeout: 4000,
      maxTimeout: 32000,
      onFailedAttempt: (error: FailedAttemptError) => {
        if (error instanceof AbortError) {
          logger.warn(
            `Fetch attempt ${error.attemptNumber} aborted: ${error.message}`,
          );
        } else {
          logger.warn(
            `Fetch attempt ${error.attemptNumber} failed. There are ${
              error.retriesLeft
            } retries left.`,
            { error: error.message },
          );
        }
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

  while (nextPageUrl) {
    try {
      const data: ApiResponse<Workspace[]> = await fetchJson<
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
      const data: ApiResponse<Variable[]> = await fetchJson<
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
